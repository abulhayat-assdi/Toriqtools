import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveProductPricing } from '@/lib/size-price';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { is_available: true },
      select: { id: true, slug: true, name: true, category: true, price: true, media_urls: true, is_featured: true, detail: true, original_price: true, discount: true, is_available: true, badges: true, sizes: true, _count: { select: { reviews: true } } },
      orderBy: [{ display_order: 'asc' }, { created_at: 'desc' }],
    });
    // Resolve list-style prices ("500,750,800") to the default size's price
    const data = products.map((p) => ({ ...p, ...resolveProductPricing(p.price, p.sizes) }));
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
