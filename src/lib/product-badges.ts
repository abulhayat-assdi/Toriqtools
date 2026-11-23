// Highlight badges an admin can tick on a product. Shown on product cards
// (top-left) and on the product page. Stored as an array of keys in
// `products.badges`.

export type BadgeKey = "hot" | "new" | "best_seller" | "trending" | "limited";

export interface BadgeDef {
  key: BadgeKey;
  label: string;
  /** CSS background (solid colour or gradient) */
  bg: string;
}

export const PRODUCT_BADGES: BadgeDef[] = [
  { key: "hot", label: "Hot", bg: "linear-gradient(135deg, #ff7a18 0%, #eb1c24 100%)" },
  { key: "new", label: "New", bg: "#1a1a1a" },
  { key: "best_seller", label: "Best Selling", bg: "linear-gradient(135deg, #f7b500 0%, #e07b00 100%)" },
  { key: "trending", label: "Trending", bg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" },
  { key: "limited", label: "Limited", bg: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" },
];

const BY_KEY = new Map(PRODUCT_BADGES.map((b) => [b.key, b]));

/** Normalise whatever is stored in the DB into known badge definitions, in display order. */
export function resolveBadges(raw: unknown): BadgeDef[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set(raw.filter((k): k is string => typeof k === "string"));
  return PRODUCT_BADGES.filter((b) => keys.has(b.key));
}

export function isBadgeKey(k: string): k is BadgeKey {
  return BY_KEY.has(k as BadgeKey);
}

function toNumber(v?: string | null): number {
  if (!v) return NaN;
  // "Tk. 2,600.00" / "৳2600" -> 2600 (take the first number, ignore currency text)
  const m = String(v).replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

/**
 * Discount badge text. Prefers a percentage computed from original vs current
 * price; falls back to the admin's free-text discount label.
 */
export function discountText(price?: string | null, originalPrice?: string | null, label?: string | null): string | null {
  const p = toNumber(price);
  const o = toNumber(originalPrice);
  if (o > 0 && p > 0 && o > p) {
    const pct = Math.round(((o - p) / o) * 100);
    if (pct >= 1) return `-${pct}%`;
  }
  const l = (label ?? "").trim();
  if (!l) return null;
  if (/^\d+(\.\d+)?$/.test(l)) return `-${l}%`;
  return l;
}
