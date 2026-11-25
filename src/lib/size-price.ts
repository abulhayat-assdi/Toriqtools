import { parsePrice } from "@/lib/parse-price";

/**
 * One size option of a product. `price` is optional: when it is empty the
 * product's base price applies to that size.
 */
export type SizeOption = { size: string; available: boolean; price?: string };

/** Accepts the raw `sizes` JSON (legacy string[] or object[]) and normalises it. */
export function normalizeSizes(raw: unknown): SizeOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((raw: unknown): SizeOption | null => {
      if (typeof raw === "string") return raw.trim() ? { size: raw.trim(), available: true } : null;
      const s = raw as { size?: unknown; available?: unknown; price?: unknown } | null;
      if (!s || typeof s.size !== "string" || !s.size.trim()) return null;
      const price = typeof s.price === "string" || typeof s.price === "number" ? String(s.price).trim() : "";
      return {
        size: s.size.trim(),
        available: s.available !== false,
        ...(price && parsePrice(price) > 0 ? { price } : {}),
      };
    })
    .filter((s): s is SizeOption => s !== null);
}

/** The size's own price if the admin set one, otherwise the base price. */
export function priceForSize(
  basePrice: string,
  sizes: SizeOption[] | undefined | null,
  size: string | null | undefined
): string {
  if (!size || !sizes) return basePrice;
  const entry = sizes.find((s) => s.size === size);
  return entry?.price && parsePrice(entry.price) > 0 ? entry.price : basePrice;
}

/** True when the selected size carries a price different from the base price. */
export function hasOverridePrice(
  basePrice: string,
  sizes: SizeOption[] | undefined | null,
  size: string | null | undefined
): boolean {
  return parsePrice(priceForSize(basePrice, sizes, size)) !== parsePrice(basePrice);
}

/** Formats a stored price string for display with the ৳ sign. */
export function formatTaka(value: string): string {
  if (!value) return "";
  return value.includes("Tk") || value.includes("৳") ? value.replace("Tk", "৳") : `৳${value}`;
}

/**
 * Re-prices a cart line for the chosen size. The product's base price and
 * regular (strike-through) price are kept on the line as `basePrice` /
 * `baseOriginalPrice` so switching sizes back and forth stays correct.
 * The regular price and discount badge only apply when the size uses the base price.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cart lines are loosely typed localStorage objects
export function applySizePrice<T extends Record<string, any>>(item: T, size: string | null | undefined): T {
  const basePrice: string = item.basePrice ?? item.price ?? "";
  const baseOriginalPrice: string = item.baseOriginalPrice ?? item.originalPrice ?? "";
  const baseDiscount: string = item.baseDiscount ?? item.discount ?? "";
  const sizes = item.availableSizes as SizeOption[] | undefined;
  const overridden = hasOverridePrice(basePrice, sizes, size);
  return {
    ...item,
    basePrice,
    baseOriginalPrice,
    baseDiscount,
    price: priceForSize(basePrice, sizes, size),
    originalPrice: overridden ? "" : baseOriginalPrice,
    discount: overridden ? "" : baseDiscount,
  };
}

/** "1,050" / "12,500.00" style — commas used only as thousands separators. */
const THOUSANDS_RE = /^\s*(?:৳|Tk\.?)?\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*$/i;

/**
 * Splits a base price the admin typed as a list of per-size prices
 * ("500,750,800,1050", "500 / 750", "500|750") into its parts.
 * Returns null for a normal single price, including "1,050".
 */
export function splitPriceList(price: string | null | undefined): string[] | null {
  if (!price || THOUSANDS_RE.test(price)) return null;
  const parts = price.split(/[,/|]/).map((p) => p.trim()).filter((p) => parsePrice(p) > 0);
  return parts.length > 1 ? parts : null;
}

/**
 * Resolves a product's pricing for display and ordering:
 * - a list-style base price is spread over the sizes in order (sizes that
 *   already have their own price keep it);
 * - the default price is the first available size's price (the first size
 *   the admin added), falling back to the first list value / base price.
 */
export function resolveProductPricing(
  rawPrice: string | null | undefined,
  rawSizes: unknown
): { price: string; sizes: SizeOption[] } {
  const base = String(rawPrice ?? "");
  const list = splitPriceList(base);
  const sizes = normalizeSizes(rawSizes).map((s, i) =>
    s.price || !list ? s : { ...s, price: list[Math.min(i, list.length - 1)] }
  );
  const defaultSize = sizes.find((s) => s.available) ?? sizes[0];
  const price = defaultSize?.price || (list ? list[0] : base);
  return { price, sizes };
}
