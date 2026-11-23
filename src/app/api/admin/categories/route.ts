import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { r2Delete } from '@/lib/r2';

const revalidateSite = () => {
  // Invalidate unstable_cache entries
  revalidateTag('categories', 'max');
  revalidateTag('products', 'max');
  // Invalidate ISR page cache
  revalidatePath('/');
  revalidatePath('/collections/all');
  revalidatePath('/collections/[slug]', 'page');
};

const EDITABLE = ['name', 'slug', 'image_url', 'is_active', 'show_in_header', 'show_in_footer', 'display_order'] as const;

function pickFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const k of EDITABLE) if (body[k] !== undefined) data[k] = body[k];
  if (body.parent_id !== undefined) data.parent_id = body.parent_id || null;
  return data;
}

// Subcategories are one level deep: a parent must itself be top-level,
// and a category that has subcategories cannot become a subcategory.
async function validateParent(id: string | null, parentId: string | null): Promise<string | null> {
  if (!parentId) return null;
  if (id && parentId === id) return 'A category cannot be its own parent.';
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parent_id: true } });
  if (!parent) return 'Parent category not found.';
  if (parent.parent_id) return 'A subcategory cannot have its own subcategories.';
  if (id && (await prisma.category.count({ where: { parent_id: id } })) > 0) {
    return 'This category has subcategories, so it cannot be moved under another category.';
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await prisma.category.findMany({ orderBy: { display_order: 'asc' } });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = pickFields(await req.json());
  const err = await validateParent(null, (body.parent_id as string | null) ?? null);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const data = await prisma.category.create({ data: body as Prisma.CategoryUncheckedCreateInput });
  revalidateSite();
  return NextResponse.json({ data }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id, ...raw } = await req.json();
  const body = pickFields(raw);

  const old = await prisma.category.findUnique({
    where: { id },
    select: { name: true, image_url: true, parent_id: true, parent: { select: { name: true } } },
  });
  if (!old) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });

  const newParentId = body.parent_id !== undefined ? (body.parent_id as string | null) : old.parent_id;
  if (newParentId !== old.parent_id) {
    const err = await validateParent(id, newParentId);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }
  const newName = (body.name as string | undefined) || old.name;
  const newParentName = newParentId
    ? (await prisma.category.findUnique({ where: { id: newParentId }, select: { name: true } }))?.name ?? null
    : null;

  const data = await prisma.$transaction(async (tx) => {
    // Products store category/subcategory by name — keep them in sync when
    // this category is renamed or moved between top-level and subcategory.
    if (newName !== old.name || newParentId !== old.parent_id) {
      const where = old.parent
        ? { category: old.parent.name, subcategory: old.name }
        : { category: old.name };
      if (!old.parent && !newParentName) {
        await tx.product.updateMany({ where, data: { category: newName } });
      } else if (newParentName) {
        await tx.product.updateMany({ where, data: { category: newParentName, subcategory: newName } });
      } else {
        await tx.product.updateMany({ where, data: { category: newName, subcategory: null } });
      }
    }
    return tx.category.update({ where: { id }, data: body });
  });

  // Delete old image if it was replaced
  if (old.image_url && body.image_url !== undefined && old.image_url !== body.image_url) {
    await r2Delete(old.image_url);
  }

  revalidateSite();
  revalidatePath('/collections/all');
  revalidatePath('/collections/[slug]', 'page');
  revalidatePath('/products/[slug]', 'page');
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await req.json();
  const category = await prisma.category.findUnique({
    where: { id },
    select: { name: true, image_url: true, parent: { select: { name: true } }, _count: { select: { children: true } } },
  });
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  if (category._count.children > 0) {
    return NextResponse.json(
      { error: 'এই ক্যাটাগরির আন্ডারে সাব-ক্যাটাগরি আছে। আগে সাব-ক্যাটাগরিগুলো ডিলিট বা সরিয়ে নিন।' },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // Products in a deleted subcategory stay in the parent category.
    if (category.parent) {
      await tx.product.updateMany({
        where: { category: category.parent.name, subcategory: category.name },
        data: { subcategory: null },
      });
    }
    await tx.category.delete({ where: { id } });
  });
  revalidateSite();

  if (category.image_url) await r2Delete(category.image_url);

  return NextResponse.json({ success: true });
}
