"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { pushEcommerce, toItem, normalizeCategory } from "@/lib/analytics";
import { resolveBadges, discountText } from "@/lib/product-badges";

export interface ProductCardProps {
  id: string;
  slug?: string;
  name: string;
  detail: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  reviews: string;
  imageUrl: string;
  category?: string;
  /** Display name of the category (use when `category` is a slug) */
  categoryName?: string;
  /** Analytics list context */
  listId?: string;
  listName?: string;
  /** 1-based position within the list */
  index?: number;
  unavailable?: boolean;
  /** Highlight badge keys ticked in admin (hot, new, best_seller, ...) */
  badges?: unknown;
  priority?: boolean;
}

export default function ProductCard({
  id,
  slug,
  name,
  detail,
  price,
  originalPrice,
  discount,
  reviews,
  imageUrl,
  category,
  categoryName,
  listId,
  listName,
  index,
  unavailable,
  badges,
  priority = false,
}: ProductCardProps) {
  const router = useRouter();

  const reviewCount = parseInt(reviews) || 0;
  const displayPrice = price?.includes("৳")
    ? price
    : price?.includes("Tk")
    ? price.replace("Tk", "৳")
    : `৳${price}`;
  const displayOriginal = originalPrice
    ? originalPrice?.includes("৳")
      ? originalPrice
      : originalPrice?.includes("Tk")
      ? originalPrice.replace("Tk", "৳")
      : `৳${originalPrice}`
    : null;

  const categoryLabel = normalizeCategory(categoryName ?? category);
  const highlightBadges = resolveBadges(badges);
  const discountBadge = discountText(price, originalPrice, discount);

  function handleSelectItem() {
    pushEcommerce("select_item", {
      items: [
        toItem({ id, name, price, category: categoryLabel, index, listName }),
      ],
      extra: { item_list_id: listId, item_list_name: listName },
    });
  }

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const existing = JSON.parse(localStorage.getItem("cart") || "[]");
    const idx = existing.findIndex((i: any) => i.id === id);
    if (idx > -1) {
      existing[idx] = { ...existing[idx], quantity: (existing[idx].quantity || 1) + 1 };
    } else {
      existing.push({ id, name, price, image: imageUrl, detail, originalPrice, discount, category: categoryLabel, quantity: 1 });
    }
    localStorage.setItem("cart", JSON.stringify(existing));

    // Dispatch a bare cart:add (no detail) so the Header refreshes its cart
    // count from localStorage WITHOUT opening the cart drawer. We go straight
    // to checkout instead.
    window.dispatchEvent(new CustomEvent("cart:add"));

    pushEcommerce("add_to_cart", {
      items: [toItem({ id, name, price, category: categoryLabel })],
    });

    router.push("/checkout");
  }

  return (
    <article className="relative flex flex-col bg-white border border-[#ebebeb] rounded-lg overflow-hidden group hover:shadow-md transition-shadow duration-300">
      {/* Image area */}
      <Link href={`/products/${slug || id}`} onClick={handleSelectItem} className="block relative">
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain transition-transform duration-500 group-hover:scale-105"
              unoptimized={imageUrl?.startsWith("/uploads/")}
              priority={priority}
              quality={80}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-[#f0f0f0]">
              <span className="text-[#ccc] text-4xl font-bold">{name[0]}</span>
            </div>
          )}

          {/* Highlight badges (ticked in admin) — top left, stacked */}
          {highlightBadges.length > 0 && (
            <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
              {highlightBadges.map((b) => (
                <span
                  key={b.key}
                  style={{ background: b.bg }}
                  className="text-white text-[9px] md:text-[10px] font-bold uppercase tracking-wide px-2 py-[5px] rounded-full leading-none shadow-[0_2px_6px_rgba(0,0,0,0.18)] whitespace-nowrap"
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {/* Discount badge — top right, brand red */}
          {discountBadge && (
            <span className="absolute top-2 right-2 z-10 bg-[#eb1c24] text-white text-[10px] md:text-[11px] font-extrabold px-2 py-[5px] rounded-full leading-none shadow-[0_2px_6px_rgba(235,28,36,0.35)] whitespace-nowrap">
              {discountBadge}
            </span>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 md:p-4">
        <Link href={`/products/${slug || id}`} onClick={handleSelectItem}>
          <h3 className="text-[13px] md:text-[14px] font-semibold text-[#1a1a1a] leading-snug hover:text-[#eb1c24] transition-colors line-clamp-2 mb-2">
            {name}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex flex-col gap-0.5 mb-3">
          {displayOriginal && (
            <span className="text-[11px] md:text-[12px] text-[#888] line-through">
              {displayOriginal}
            </span>
          )}
          <span className="text-[15px] md:text-[16px] font-bold text-[#eb1c24]">
            {displayPrice}
          </span>
        </div>

        {/* Star rating — only when reviews exist */}
        {reviewCount > 0 && (
          <div className="flex items-center gap-0.5 mb-2">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className="w-3 h-3 text-amber-400 fill-amber-400"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
            <span className="text-[11px] text-[#888] ml-1">({reviewCount})</span>
          </div>
        )}

        {/* Order button */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={unavailable}
          className={`mt-auto w-full flex items-center justify-center gap-2 py-3 md:py-3.5 text-[15px] md:text-[17px] font-bold rounded-xl transition-all duration-200 ${
            unavailable
              ? "bg-[#e5e5e5] text-[#999] cursor-not-allowed"
              : "bg-[#eb1c24] text-white shadow-[0_6px_16px_-4px_rgba(235,28,36,0.55)] hover:bg-[#c4141b] hover:shadow-[0_8px_20px_-4px_rgba(196,20,27,0.6)] active:scale-[0.98]"
          }`}
        >
          {!unavailable && <ShoppingCart className="w-[18px] h-[18px] md:w-5 md:h-5 fill-current" strokeWidth={2.2} aria-hidden />}
          {unavailable ? "Unavailable" : "অর্ডার করুন"}
        </button>
      </div>
    </article>
  );
}
