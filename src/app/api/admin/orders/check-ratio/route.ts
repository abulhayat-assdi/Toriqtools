import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { getCourierFraudCheck, normalizePhone } from '@/lib/bd-courier-fraud';

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { phone, force } = await req.json();
    if (!phone || phone === '—') {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const cleanedPhone = normalizePhone(phone);
    if (!cleanedPhone) {
      return NextResponse.json({ error: `Invalid phone number format: ${phone}` }, { status: 400 });
    }

    // BD Courier cross-courier check — served from the DB cache unless it is stale.
    //    `force` still respects the global budget and the rate-limit cooldown.
    const lookup = await getCourierFraudCheck(cleanedPhone, { force: force === true });

    const steadfast = lookup.stats
      ? lookup.stats
      : lookup.error
        ? { error: lookup.error }
        : null;

    return NextResponse.json({
      success: true,
      steadfast,
      steadfast_meta: {
        cached: lookup.cached,
        stale: lookup.stale,
        fetched_at: lookup.fetched_at,
        next_retry_at: lookup.next_retry_at,
      },
    });
  } catch (error: unknown) {
    console.error('Error in check-ratio:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
