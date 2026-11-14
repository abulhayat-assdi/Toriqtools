import { prisma } from '@/lib/db';

/**
 * BD Courier courier-check (cross-courier delivery ratio) lookups.
 *
 * The API has a limited search quota, so this module makes sure a
 * phone number is looked up at most once per TTL window:
 *
 *  1. Responses are stored in the `steadfast_fraud_cache` table and re-served
 *     until they go stale — page loads / modal re-opens never hit the API.
 *  2. Outgoing calls are metered globally (per hour + per day) through the
 *     `steadfast_api_state` row, so a burst of admin clicks cannot drain the quota.
 *  3. A `429` (or a "rate limit" message) puts the whole integration into a
 *     cooldown; during that time cached data is served instead of calling again.
 *  4. Transient failures (network / 5xx) are retried with exponential backoff.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** How long a stored response stays fresh (no API call at all within this window). */
const CACHE_TTL_MS = envInt('BDCOURIER_FRAUD_CACHE_HOURS', 12) * HOUR;
/** Hard caps on outgoing fraud_check calls. */
const MAX_PER_HOUR = envInt('BDCOURIER_FRAUD_MAX_PER_HOUR', 30);
const MAX_PER_DAY = envInt('BDCOURIER_FRAUD_MAX_PER_DAY', 150);
/** Pause the whole integration for this long after BD Courier reports a rate limit. */
const COOLDOWN_MS = envInt('BDCOURIER_FRAUD_COOLDOWN_MINUTES', 15) * MINUTE;
/** Minimum spacing between two outgoing calls. */
const MIN_GAP_MS = envInt('BDCOURIER_FRAUD_MIN_GAP_MS', 1200);

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

/** The UI matches on "rate limit", keep that substring in the message. */
const RATE_LIMIT_MESSAGE = 'BD Courier API rate limit exceeded';

export type CourierBreakdown = {
  key: string;
  name: string;
  logo: string | null;
  total: number;
  success: number;
  cancel: number;
  success_rate: number;
};

export type CourierStats = {
  total: number;
  success: number;
  cancel: number;
  success_rate: number;
  /** Per-courier numbers (only couriers with at least one parcel). */
  couriers: CourierBreakdown[];
  fraud_reports: unknown[];
};

export type CourierLookup = {
  /** Parsed stats, or null when BD Courier has no global record for this number. */
  stats: CourierStats | null;
  /** Set when the live call failed (may be accompanied by stale `stats`). */
  error: string | null;
  /** True when nothing was requested from BD Courier for this lookup. */
  cached: boolean;
  /** True when `stats` came from an expired cache entry because the call failed. */
  stale: boolean;
  fetched_at: string | null;
  /** When the next live call may be attempted (cooldown / quota exhausted). */
  next_retry_at: string | null;
};

type CacheRow = {
  phone: string;
  found: boolean;
  total: number;
  success: number;
  cancel: number;
  success_rate: number;
  fraud_reports: unknown;
  fetched_at: Date;
};

type ApiStateRow = {
  id: string;
  last_call_at: Date | null;
  cooldown_until: Date | null;
  window_start: Date | null;
  window_count: number;
  day_start: Date | null;
  day_count: number;
};

/**
 * Normalises a Bangladeshi number to the 11 digit form the API expects
 * (e.g. `01712345678`). Returns null when the input cannot be a valid number.
 */
export function normalizePhone(phone: string): string | null {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length > 11) {
    cleaned = cleaned.slice(-11);
  }
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  if (cleaned.length !== 11 || !cleaned.startsWith('01')) return null;
  return cleaned;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toStats(row: CacheRow): CourierStats | null {
  if (!row.found) return null;
  // Rows written by the old BD Courier integration stored a bare array; they carry
  // no per-courier data, so treat them as a miss.
  const payload = row.fraud_reports as { couriers?: unknown; reports?: unknown } | null;
  if (!payload || Array.isArray(payload) || !Array.isArray(payload.couriers)) return null;
  return {
    total: row.total,
    success: row.success,
    cancel: row.cancel,
    success_rate: row.success_rate,
    couriers: payload.couriers as CourierBreakdown[],
    fraud_reports: Array.isArray(payload.reports) ? payload.reports : [],
  };
}

function isUsableCache(row: CacheRow): boolean {
  const payload = row.fraud_reports as { couriers?: unknown } | null;
  return !!payload && !Array.isArray(payload) && Array.isArray(payload.couriers);
}

async function readCache(phone: string): Promise<CacheRow | null> {
  const rows = await prisma.$queryRaw<CacheRow[]>`
    SELECT phone, found, total, success, cancel, success_rate, fraud_reports, fetched_at
    FROM "steadfast_fraud_cache" WHERE phone = ${phone} LIMIT 1
  `;
  const row = rows[0];
  return row && isUsableCache(row) ? row : null;
}

async function writeCache(phone: string, stats: CourierStats | null, now: Date): Promise<void> {
  const reports = JSON.stringify({ couriers: stats?.couriers ?? [], reports: stats?.fraud_reports ?? [] });
  await prisma.$executeRaw`
    INSERT INTO "steadfast_fraud_cache"
      (phone, found, total, success, cancel, success_rate, fraud_reports, fetched_at, updated_at)
    VALUES (
      ${phone}, ${stats !== null}, ${stats?.total ?? 0}, ${stats?.success ?? 0},
      ${stats?.cancel ?? 0}, ${stats?.success_rate ?? 0}, ${reports}::jsonb, ${now}, ${now}
    )
    ON CONFLICT (phone) DO UPDATE SET
      found = EXCLUDED.found,
      total = EXCLUDED.total,
      success = EXCLUDED.success,
      cancel = EXCLUDED.cancel,
      success_rate = EXCLUDED.success_rate,
      fraud_reports = EXCLUDED.fraud_reports,
      fetched_at = EXCLUDED.fetched_at,
      updated_at = EXCLUDED.updated_at
  `;
}

async function readApiState(now: Date): Promise<ApiStateRow> {
  await prisma.$executeRaw`
    INSERT INTO "steadfast_api_state" (id, window_start, window_count, day_start, day_count, updated_at)
    VALUES ('singleton', ${now}, 0, ${now}, 0, ${now})
    ON CONFLICT (id) DO NOTHING
  `;
  const rows = await prisma.$queryRaw<ApiStateRow[]>`
    SELECT id, last_call_at, cooldown_until, window_start, window_count, day_start, day_count
    FROM "steadfast_api_state" WHERE id = 'singleton' LIMIT 1
  `;
  return rows[0];
}

type Reservation =
  | { granted: true }
  | { granted: false; reason: 'cooldown' | 'quota'; retryAt: Date };

/**
 * Atomically claims one outgoing call from the global budget. A single UPDATE
 * does the window rollover and the limit check together, so parallel admin
 * requests (or serverless instances) cannot both slip past the cap.
 */
async function reserveCallSlot(now: Date): Promise<Reservation> {
  const state = await readApiState(now);

  if (state?.cooldown_until && state.cooldown_until > now) {
    return { granted: false, reason: 'cooldown', retryAt: state.cooldown_until };
  }

  // Space calls out instead of failing them; the wait is capped by MIN_GAP_MS.
  if (state?.last_call_at) {
    const gap = MIN_GAP_MS - (now.getTime() - state.last_call_at.getTime());
    if (gap > 0) await sleep(Math.min(gap, MIN_GAP_MS));
  }

  const stamp = new Date();
  const hourCutoff = new Date(stamp.getTime() - HOUR);
  const dayCutoff = new Date(stamp.getTime() - DAY);

  const granted = await prisma.$queryRaw<ApiStateRow[]>`
    UPDATE "steadfast_api_state" SET
      window_count = CASE WHEN window_start IS NULL OR window_start <= ${hourCutoff} THEN 1 ELSE window_count + 1 END,
      window_start = CASE WHEN window_start IS NULL OR window_start <= ${hourCutoff} THEN ${stamp} ELSE window_start END,
      day_count    = CASE WHEN day_start IS NULL OR day_start <= ${dayCutoff} THEN 1 ELSE day_count + 1 END,
      day_start    = CASE WHEN day_start IS NULL OR day_start <= ${dayCutoff} THEN ${stamp} ELSE day_start END,
      last_call_at = ${stamp},
      updated_at   = ${stamp}
    WHERE id = 'singleton'
      AND (cooldown_until IS NULL OR cooldown_until <= ${stamp})
      AND (window_start IS NULL OR window_start <= ${hourCutoff} OR window_count < ${MAX_PER_HOUR})
      AND (day_start IS NULL OR day_start <= ${dayCutoff} OR day_count < ${MAX_PER_DAY})
    RETURNING id, last_call_at, cooldown_until, window_start, window_count, day_start, day_count
  `;

  if (granted.length > 0) return { granted: true };

  const current = await readApiState(stamp);
  if (current?.cooldown_until && current.cooldown_until > stamp) {
    return { granted: false, reason: 'cooldown', retryAt: current.cooldown_until };
  }
  const hourlyExhausted =
    !!current?.window_start && current.window_start > hourCutoff && current.window_count >= MAX_PER_HOUR;
  const retryAt = hourlyExhausted
    ? new Date(current!.window_start!.getTime() + HOUR)
    : new Date((current?.day_start?.getTime() ?? stamp.getTime()) + DAY);
  return { granted: false, reason: 'quota', retryAt };
}

async function startCooldown(retryAfterMs: number): Promise<Date> {
  const now = new Date();
  const until = new Date(now.getTime() + Math.max(retryAfterMs, MINUTE));
  await prisma.$executeRaw`
    UPDATE "steadfast_api_state" SET cooldown_until = ${until}, updated_at = ${now} WHERE id = 'singleton'
  `;
  return until;
}

function parseRetryAfter(header: string | null): number {
  if (!header) return COOLDOWN_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    if (delta > 0) return delta;
  }
  return COOLDOWN_MS;
}

function looksRateLimited(status: number, body: unknown): boolean {
  if (status === 429) return true;
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  return /rate.?limit|too many request|limit exceeded/i.test(text);
}

function parseStats(body: any): CourierStats | null {
  const data = body?.data;
  if (!data || typeof data !== 'object') return null;

  const couriers: CourierBreakdown[] = Object.entries(data)
    .filter(([key, value]) => key !== 'summary' && value && typeof value === 'object')
    .map(([key, value]: [string, any]) => ({
      key,
      name: String(value.name ?? key),
      logo: typeof value.logo === 'string' ? value.logo : null,
      total: Number(value.total_parcel ?? 0),
      success: Number(value.success_parcel ?? 0),
      cancel: Number(value.cancelled_parcel ?? 0),
      success_rate: Math.round(Number(value.success_ratio ?? 0)),
    }))
    .filter(c => c.total > 0);

  const summary = data.summary ?? {};
  const total = Number(summary.total_parcel ?? couriers.reduce((n, c) => n + c.total, 0));
  const success = Number(summary.success_parcel ?? couriers.reduce((n, c) => n + c.success, 0));
  const cancel = Number(summary.cancelled_parcel ?? couriers.reduce((n, c) => n + c.cancel, 0));
  const fraud_reports = Array.isArray(body?.reports) ? body.reports : [];

  if (!(total > 0) && fraud_reports.length === 0) return null;

  return {
    total,
    success,
    cancel,
    success_rate: total > 0 ? Math.round((success / total) * 100) : 0,
    couriers,
    fraud_reports,
  };
}

type CallOutcome =
  | { kind: 'ok'; stats: CourierStats | null }
  | { kind: 'rate_limited'; retryAfterMs: number }
  | { kind: 'error'; message: string };

/** One fraud_check call, retrying only transient failures (network / 5xx). */
async function callBdCourier(phone: string): Promise<CallOutcome> {
  const apiKey = process.env.BDCOURIER_API_KEY || '';
  if (!apiKey) {
    return { kind: 'error', message: 'BD Courier API key is not configured' };
  }

  let lastError = 'BD Courier API request failed';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch('https://api.bdcourier.com/courier-check', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      });

      const raw = await res.text();
      let body: any = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = raw;
      }

      if (looksRateLimited(res.status, body)) {
        return { kind: 'rate_limited', retryAfterMs: parseRetryAfter(res.headers.get('retry-after')) };
      }

      if (res.ok && body?.status !== 'error') {
        return { kind: 'ok', stats: parseStats(body) };
      }

      // "Phone number not found" just means the number has no history anywhere.
      if (body?.status === 'error' && /not found/i.test(String(body?.message ?? ''))) {
        return { kind: 'ok', stats: null };
      }

      lastError = body?.message || body?.error || `BD Courier API error (HTTP ${res.status})`;

      // 4xx other than 429 will not fix itself — do not spend more quota on it.
      if (res.status < 500) return { kind: 'error', message: lastError };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : 'BD Courier API request failed';
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(600 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200));
    }
  }

  return { kind: 'error', message: lastError };
}

/** De-duplicates concurrent lookups of the same number within one instance. */
const inflight = new Map<string, Promise<CourierLookup>>();

async function lookup(phone: string, force: boolean): Promise<CourierLookup> {
  const now = new Date();
  const cached = await readCache(phone);

  if (cached && !force && now.getTime() - cached.fetched_at.getTime() < CACHE_TTL_MS) {
    return {
      stats: toStats(cached),
      error: null,
      cached: true,
      stale: false,
      fetched_at: cached.fetched_at.toISOString(),
      next_retry_at: null,
    };
  }

  const staleFallback = (error: string, retryAt: Date | null): CourierLookup => ({
    stats: cached ? toStats(cached) : null,
    error: cached ? null : error,
    cached: !!cached,
    stale: !!cached,
    fetched_at: cached ? cached.fetched_at.toISOString() : null,
    next_retry_at: retryAt ? retryAt.toISOString() : null,
  });

  const reservation = await reserveCallSlot(now);
  if (!reservation.granted) {
    const message =
      reservation.reason === 'cooldown'
        ? RATE_LIMIT_MESSAGE
        : `${RATE_LIMIT_MESSAGE} (daily/hourly search budget used up)`;
    return staleFallback(message, reservation.retryAt);
  }

  const outcome = await callBdCourier(phone);

  if (outcome.kind === 'rate_limited') {
    const until = await startCooldown(outcome.retryAfterMs);
    return staleFallback(RATE_LIMIT_MESSAGE, until);
  }

  if (outcome.kind === 'error') {
    return staleFallback(outcome.message, null);
  }

  await writeCache(phone, outcome.stats, new Date());
  return {
    stats: outcome.stats,
    error: null,
    cached: false,
    stale: false,
    fetched_at: new Date().toISOString(),
    next_retry_at: null,
  };
}

/**
 * Returns BD Courier delivery/fraud stats for a number, hitting the API only
 * when the cached copy is missing or older than the TTL.
 */
export async function getCourierFraudCheck(
  phone: string,
  options: { force?: boolean } = {}
): Promise<CourierLookup> {
  const force = !!options.force;
  const key = `${phone}:${force ? 'force' : 'cached'}`;

  const running = inflight.get(key);
  if (running) return running;

  const promise = lookup(phone, force).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
