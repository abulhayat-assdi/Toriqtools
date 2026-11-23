import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/admin-auth';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type NewLine = {
  product_id: string;
  quantity: number;
  size?: string | null;
  color?: string | null;
  price?: number | string | null;
};

const parsePrice = (raw: unknown): number => parseFloat(String(raw ?? '').replace(/[^0-9.]/g, '')) || 0;

function normalizePhone(raw: string): string {
  let num = String(raw || '').replace(/[\s\-()]/g, '');
  if (num.startsWith('+880')) num = '0' + num.slice(4);
  else if (num.startsWith('880')) num = '0' + num.slice(3);
  return num;
}

function validQuantity(q: unknown): q is number {
  return Number.isInteger(q) && (q as number) >= 1 && (q as number) <= 1000;
}

/**
 * Turns admin-picked lines into order_items rows. Name and image always come
 * from the product record; the price defaults to the product's price but the
 * admin may override it (e.g. a price agreed on Messenger/WhatsApp).
 */
async function resolveNewLines(lines: NewLine[]) {
  const ids = [...new Set(lines.map(l => l.product_id))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, price: true, media_urls: true },
  });
  const map = new Map(products.map(p => [p.id, p]));
  return lines.map(line => {
    const product = map.get(line.product_id);
    if (!product) throw new HttpError(400, 'Product not found');
    if (!validQuantity(line.quantity)) throw new HttpError(400, 'Quantity must be between 1 and 1000');
    const media = product.media_urls as unknown;
    const image = Array.isArray(media) && typeof media[0] === 'string' ? media[0] : '';
    const hasCustomPrice = line.price !== undefined && line.price !== null && line.price !== '';
    return {
      product_id: product.id,
      product_name: product.name,
      price: hasCustomPrice ? parsePrice(line.price) : parsePrice(product.price),
      quantity: line.quantity,
      image_url: image,
      size: line.size ? String(line.size) : null,
      color: line.color ? String(line.color) : null,
    };
  });
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const orders = await prisma.order.findMany({
    orderBy: { placed_at: 'desc' },
    include: { items: true },
  });

  // Pre-calculate statistics by phone number
  const cleanPhoneForMatch = (phoneStr: string): string => {
    const cleaned = phoneStr.replace(/\D/g, '');
    return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
  };

  const statsMap = new Map<string, { total: number; success: number; cancel: number }>();

  for (const o of orders) {
    if (o.status === 'incomplete') continue; // exclude drafts from stats
    const key = cleanPhoneForMatch(o.phone);
    if (!key) continue;

    const current = statsMap.get(key) || { total: 0, success: 0, cancel: 0 };
    current.total += 1;
    if (o.status === 'delivered') {
      current.success += 1;
    } else if (o.status === 'returned' || o.status === 'cancelled') {
      current.cancel += 1;
    }
    statsMap.set(key, current);
  }

  const completedPhones = new Set(statsMap.keys());

  // Filter out incomplete orders of customers who completed checkout later
  const filteredOrders = orders.filter(o => {
    if (o.status === 'incomplete') {
      // Abandoned orders only count when the customer gave a phone number
      if (!o.phone || o.phone === '—') return false;
      const p = cleanPhoneForMatch(o.phone);
      return p.length > 0 && !completedPhones.has(p);
    }
    return true;
  });

  // Map orders to include local_stats in the payload (representing past history)
  const ordersWithStats = filteredOrders.map(o => {
    const key = cleanPhoneForMatch(o.phone);
    const stats = statsMap.get(key) || { total: 0, success: 0, cancel: 0 };

    // Deduct current order to get PAST history
    let pastTotal = stats.total;
    let pastSuccess = stats.success;
    let pastCancel = stats.cancel;

    if (o.status !== 'incomplete') {
      pastTotal = Math.max(0, pastTotal - 1);
      if (o.status === 'delivered') {
        pastSuccess = Math.max(0, pastSuccess - 1);
      } else if (o.status === 'returned' || o.status === 'cancelled') {
        pastCancel = Math.max(0, pastCancel - 1);
      }
    }

    return {
      ...o,
      local_stats: {
        total: pastTotal,
        success: pastSuccess,
        cancel: pastCancel,
      },
    };
  });

  return NextResponse.json({ data: ordersWithStats });
}

// Manual order entry — orders taken over Messenger / WhatsApp / phone.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { customer_name, phone, address, items, shipping, discount } = body as {
      customer_name?: string; phone?: string; address?: string;
      items?: NewLine[]; shipping?: number; discount?: number;
    };

    const name = String(customer_name || '').trim();
    const addr = String(address || '').trim();
    const normalizedPhone = normalizePhone(phone || '');
    if (!name || !addr || !normalizedPhone) {
      return NextResponse.json({ error: 'নাম, ফোন নম্বর ও ঠিকানা দিন।' }, { status: 400 });
    }
    if (!/^01[3-9][0-9]{8}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (01XXXXXXXXX)।' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'অন্তত একটি প্রোডাক্ট যোগ করুন।' }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'Order cannot contain more than 50 items' }, { status: 400 });
    }

    const resolved = await resolveNewLines(items);
    const subtotal = resolved.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const shippingCharge = Math.max(0, Number(shipping) || 0);
    const discountAmount = Math.min(Math.max(0, Number(discount) || 0), subtotal);
    const total = subtotal + shippingCharge - discountAmount;

    const order = await prisma.order.create({
      data: {
        order_id: `NF-${randomBytes(16).toString('hex').toUpperCase()}`,
        customer_name: name,
        phone: normalizedPhone,
        address: addr,
        subtotal,
        shipping: shippingCharge,
        discount: discountAmount,
        total,
        payment_method: 'cash',
        amount_paid: 0,
        status: 'pending',
        // Manual entries are not website conversions — never send them to Meta.
        capi_sent: true,
        items: { create: resolved },
      },
      include: { items: true },
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error creating manual order:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, items, removed_item_ids, ...data } = await req.json();

    const updateData: any = { ...data };
    if (updateData.subtotal !== undefined) updateData.subtotal = Number(updateData.subtotal);
    if (updateData.shipping !== undefined) updateData.shipping = Number(updateData.shipping);
    if (updateData.discount !== undefined) updateData.discount = Number(updateData.discount);
    if (updateData.total !== undefined) updateData.total = Number(updateData.total);

    const itemList: any[] = Array.isArray(items) ? items : [];
    const removedIds: string[] = Array.isArray(removed_item_ids) ? removed_item_ids.map(String) : [];
    const itemsChanged = Array.isArray(items) || removedIds.length > 0;

    // New lines (no id yet) are products the admin added to this order.
    const newLines = itemList.filter(i => !i.id && i.product_id).map(i => ({
      product_id: String(i.product_id),
      quantity: parseInt(i.quantity),
      size: i.size,
      color: i.color,
      price: i.price,
    }));
    const resolvedNew = newLines.length > 0 ? await resolveNewLines(newLines) : [];

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id }, select: { order_id: true } });
      if (!existing) throw new HttpError(404, 'Order not found');

      await tx.order.update({
        where: { id },
        data: updateData,
      });

      if (removedIds.length > 0) {
        await tx.orderItem.deleteMany({ where: { id: { in: removedIds }, order_id: existing.order_id } });
      }

      for (const item of itemList) {
        if (item.id) {
          if (item.quantity !== undefined && !validQuantity(parseInt(item.quantity))) {
            throw new HttpError(400, 'Quantity must be between 1 and 1000');
          }
          await tx.orderItem.updateMany({
            where: { id: item.id, order_id: existing.order_id },
            data: {
              size: item.size,
              color: item.color,
              price: item.price !== undefined ? Number(item.price) : undefined,
              quantity: item.quantity !== undefined ? parseInt(item.quantity) : undefined,
            },
          });
        }
      }

      if (resolvedNew.length > 0) {
        await tx.orderItem.createMany({
          data: resolvedNew.map(r => ({ ...r, order_id: existing.order_id })),
        });
      }

      // Whenever the item list changed, totals are recomputed from what is
      // actually stored so the courier COD amount can never drift.
      if (itemsChanged) {
        const rows = await tx.orderItem.findMany({ where: { order_id: existing.order_id } });
        if (rows.length === 0) throw new HttpError(400, 'অর্ডারে অন্তত একটি প্রোডাক্ট থাকতে হবে।');
        const order = await tx.order.findUniqueOrThrow({ where: { id }, select: { shipping: true, discount: true } });
        const subtotal = rows.reduce((acc, r) => acc + Number(r.price) * r.quantity, 0);
        const total = subtotal + Number(order.shipping) - Number(order.discount);
        await tx.order.update({ where: { id }, data: { subtotal, total } });
      }

      return tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
    });

    return NextResponse.json({ data: result });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error updating order:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await req.json();
    // Delete order items first (cascade should handle it, but being explicit)
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
