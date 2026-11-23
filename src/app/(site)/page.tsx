import { unstable_cache } from "next/cache";
import HeroBanner from "@/components/home/HeroBanner";
import TrustBadges from "@/components/home/TrustBadges";
import Bestsellers from "@/components/home/Bestsellers";
import CategorySections from "@/components/home/CategorySections";
import ComboSection from "@/components/home/ComboSection";
import CustomerReviews from "@/components/home/CustomerReviews";
import { prisma } from "@/lib/db";

export const revalidate = 3600;

const BEST_SELLER_LIMIT = 8;

export const metadata = { alternates: { canonical: "/" } };

const getHomeData = unstable_cache(
  async () => {
    const [categories, allProducts] = await Promise.all([
      prisma.category.findMany({
        // Main categories only; subcategory products are listed under their parent.
        where: { is_active: true, parent_id: null },
        orderBy: { display_order: "asc" },
      }),
      prisma.product.findMany({
        where: { is_available: true },
        orderBy: [{ display_order: "asc" }, { created_at: "desc" }],
        select: {
          id: true, slug: true, name: true, detail: true, price: true,
          original_price: true, discount: true, media_urls: true,
          category: true, is_available: true, is_featured: true,
        },
      }),
    ]);
    // Best sellers: rank by units sold on real orders, then top up with
    // admin-featured products, then by display order, up to BEST_SELLER_LIMIT.
    const sold = await prisma.orderItem.groupBy({
      by: ["product_id"],
      where: { order: { status: { notIn: ["cancelled", "returned", "incomplete"] } } },
      _sum: { quantity: true },
    });
    const soldQty = new Map(sold.map(s => [s.product_id, s._sum.quantity ?? 0]));
    const bestSellers = allProducts
      .map((p, i) => ({ p, i, qty: soldQty.get(p.id) ?? 0 }))
      .sort((a, b) =>
        b.qty - a.qty ||
        Number(b.p.is_featured) - Number(a.p.is_featured) ||
        a.i - b.i
      )
      .slice(0, BEST_SELLER_LIMIT)
      .map(x => x.p);

    return { categories, allProducts, bestSellers };
  },
  ["home-data"],
  { revalidate: 3600, tags: ["products", "categories"] }
);

export default async function Home() {
  let categories: any[] = [];
  let allProducts: any[] = [];
  let bestSellers: Awaited<ReturnType<typeof getHomeData>>["bestSellers"] = [];
  try {
    const data = await getHomeData();
    categories = data.categories;
    allProducts = data.allProducts;
    bestSellers = data.bestSellers;
  } catch {
    // DB unavailable at build time
  }

  return (
    <>
      <HeroBanner />
      <TrustBadges />
      {bestSellers.length > 0 && <Bestsellers initialProducts={bestSellers} />}
      <CategorySections categories={categories || []} products={allProducts || []} />
      <ComboSection />
      <CustomerReviews />
    </>
  );
}
