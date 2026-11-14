import { parsePrice } from "@/lib/parse-price";

export { parsePrice };

export const CURRENCY = "BDT";
const BRAND = "Toriq Tools";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_category: string;
  item_variant?: string;
  item_list_name?: string;
  index?: number;
  price: number;
  quantity: number;
};

type CategoryRef = { name: string; slug?: string | null };

const SLUG_LIKE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Returns the category DISPLAY NAME. A slug is resolved against `categories`
 * (when the caller has them loaded), otherwise title-cased. Never a slug,
 * never a "Fashion" fallback.
 */
export function normalizeCategory(name?: string, slug?: string, categories?: CategoryRef[]): string {
  const n = name?.trim();
  const s = slug?.trim();
  const lookup = (v: string) => categories?.find((c) => c.slug === v || c.name.trim().toLowerCase() === v.toLowerCase())?.name.trim();

  if (n && !SLUG_LIKE.test(n)) return n;
  const raw = n || s;
  if (!raw) return "Uncategorized";
  const found = lookup(raw) || (s ? lookup(s) : undefined);
  if (found) return found;
  return SLUG_LIKE.test(raw) ? titleCase(raw) : raw;
}

const isUsableColorName = (c: string) =>
  !!c && !/^(https?:|\/|data:)/i.test(c) && !/^(#|rgb|hsl)/i.test(c);

export function variantLabel(size?: string, color?: string): string | undefined {
  const s = size?.trim();
  const c = color?.trim();
  const colorName = c && isUsableColorName(c) ? c : undefined;
  if (s && colorName) return `${s} / ${colorName}`;
  return s || colorName || undefined;
}

export function toItem(input: {
  id: string | number;
  name: string;
  price: string | number;
  quantity?: number;
  category?: string;
  categorySlug?: string;
  categories?: CategoryRef[];
  size?: string;
  color?: string;
  index?: number;
  listName?: string;
}): AnalyticsItem {
  const item: AnalyticsItem = {
    item_id: String(input.id),
    item_name: input.name,
    item_brand: BRAND,
    item_category: normalizeCategory(input.category, input.categorySlug, input.categories),
    price: parsePrice(input.price),
    quantity: input.quantity ?? 1,
  };
  const variant = variantLabel(input.size, input.color);
  if (variant) item.item_variant = variant;
  if (input.listName) item.item_list_name = input.listName;
  if (input.index !== undefined) item.index = input.index;
  return item;
}

export function pushEvent(
  event: string,
  payload?: Record<string, unknown>,
  opts?: { eventId?: string }
): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (payload && "ecommerce" in payload) window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event,
    event_id: opts?.eventId ?? crypto.randomUUID(),
    ...payload,
  });
}

export function pushEcommerce(
  event: string,
  opts: {
    items: AnalyticsItem[];
    value?: number;
    extra?: Record<string, unknown>;
    eventId?: string;
  }
): void {
  const value =
    opts.value ?? opts.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  pushEvent(
    event,
    { ecommerce: { currency: CURRENCY, value: Number(value), ...opts.extra, items: opts.items } },
    { eventId: opts.eventId }
  );
}

/** Contact link click (WhatsApp / phone). Never blocks the link. */
export function trackContactClick(
  contactMethod: "whatsapp" | "phone",
  linkLocation: "product_page" | "bottom_nav" | "footer" | "checkout" | "contact_page",
  product?: { name: string; price: string | number }
): void {
  if (typeof window === "undefined") return;
  pushEvent("contact_click", {
    contact_method: contactMethod,
    link_location: linkLocation,
    page_path: window.location.pathname,
    ...(linkLocation === "product_page" && product
      ? { item_name: product.name, value: parsePrice(product.price) }
      : {}),
  });
}

/** A cart / order line as stored in localStorage (`cart`, `sv_buy_now_item`, `sv_last_order`). */
export type CartLine = {
  id: string | number;
  name: string;
  price: string | number;
  quantity?: number;
  category?: string;
  selectedSize?: string;
  size?: string;
  selectedColorIdx?: number;
  availableColors?: string[];
  color?: string;
};

export function cartLineToItem(line: CartLine, opts?: { index?: number; listName?: string }): AnalyticsItem {
  const color =
    line.color ??
    (line.selectedColorIdx !== undefined && line.selectedColorIdx !== null
      ? line.availableColors?.[line.selectedColorIdx]
      : undefined);
  return toItem({
    id: line.id,
    name: line.name,
    price: line.price,
    quantity: line.quantity || 1,
    category: line.category,
    size: line.selectedSize ?? line.size,
    color,
    index: opts?.index,
    listName: opts?.listName,
  });
}

export const cartValue = (items: AnalyticsItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.quantity, 0);
