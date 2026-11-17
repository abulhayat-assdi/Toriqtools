"use server";

import { prisma } from '@/lib/db';
import { getServerUser } from '@/lib/auth';
import { revalidatePath } from "next/cache";
import { hash } from 'bcryptjs';

export async function getAdmins() {
  const caller = await getServerUser('admin');
  if (!caller || (caller.role !== 'admin' && caller.role !== 'super_admin')) {
    throw new Error('Unauthorized');
  }

  const admins = await prisma.customer.findMany({
    where: { role: { in: ['admin', 'super_admin'] } },
    select: { id: true, name: true, email: true, role: true, created_at: true },
    orderBy: { created_at: 'asc' },
  });

  return admins.map(a => ({
    id: a.id,
    name: a.name || '',
    email: a.email || '',
    role: a.role || 'customer',
    created_at: a.created_at.toISOString(),
  }));
}

export async function createAdmin(input: {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'super_admin';
}) {
  const caller = await getServerUser('admin');
  if (!caller || caller.role !== 'super_admin') {
    return { error: 'শুধু Super Admin নতুন অ্যাডমিন তৈরি করতে পারবেন।' };
  }

  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password ?? '';
  const role = input.role === 'super_admin' ? 'super_admin' : 'admin';

  if (!name || !email || !password) {
    return { error: 'নাম, ইমেইল এবং পাসওয়ার্ড দিতে হবে।' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'সঠিক ইমেইল দিন।' };
  }
  if (password.length < 8) {
    return { error: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' };
  }

  try {
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing && (existing.role === 'admin' || existing.role === 'super_admin')) {
      return { error: 'এই ইমেইলে ইতিমধ্যে একজন অ্যাডমিন আছেন।' };
    }

    const password_hash = await hash(password, 12);

    // An existing customer account with this email is upgraded in place
    // (name/password replaced) so the email stays unique.
    const admin = existing
      ? await prisma.customer.update({
          where: { id: existing.id },
          data: { name, role, password_hash },
        })
      : await prisma.customer.create({
          data: { name, email, role, password_hash },
        });

    revalidatePath('/admin/manage-admins');
    return {
      success: true,
      upgraded: Boolean(existing),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        created_at: admin.created_at.toISOString(),
      },
    };
  } catch (err: unknown) {
    console.error('Error creating admin:', err);
    return { error: 'অ্যাডমিন তৈরি করা যায়নি। আবার চেষ্টা করুন।' };
  }
}

export async function setAdminRole(userId: string, role: 'admin' | 'super_admin' | 'customer') {
  const caller = await getServerUser('admin');
  if (!caller || caller.role !== 'super_admin') {
    throw new Error('Unauthorized');
  }

  try {
    await prisma.customer.update({
      where: { id: userId },
      data: { role },
    });
    revalidatePath('/admin/manage-admins');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update role';
    console.error("Error setting admin role:", err);
    return { error: message };
  }
}
