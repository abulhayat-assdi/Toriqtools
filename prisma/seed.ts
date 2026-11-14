import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Toriq Tools — initial data for a fresh database.
// Safe to re-run: settings are upserted, categories/pages are only created if missing.

const CATEGORIES: { name: string; slug: string }[] = [
  { name: 'Hand Tools', slug: 'hand-tools' },
  { name: 'Cutting Tools', slug: 'cutting-tools' },
  { name: 'Measuring Tools', slug: 'measuring-tools' },
  { name: 'Ceramic Tools', slug: 'ceramic-tools' },
  { name: 'Woodworking Tools', slug: 'woodworking-tools' },
  { name: 'Gardening Tools', slug: 'gardening-tools' },
  { name: 'Puller', slug: 'puller' },
  { name: 'Stripper', slug: 'stripper' },
  { name: 'Electronics', slug: 'electronics' },
];

const PAGES: { slug: string; title: string }[] = [
  { slug: 'privacy-policy', title: 'Privacy Policy' },
  { slug: 'return-policy', title: 'Return Policy' },
  { slug: 'delivery-policy', title: 'Delivery Policy' },
];

async function main() {
  // ── 1. Super admin ────────────────────────────────────────────
  const email = process.env.ADMIN_EMAIL || 'admin@toriqtools.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const name = process.env.ADMIN_NAME || 'Toriq Tools Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.customer.upsert({
    where: { email },
    update: { role: 'super_admin', password_hash: passwordHash, name },
    create: { email, name, role: 'super_admin', password_hash: passwordHash },
  });
  console.log(`✅ Super admin: ${admin.email}`);

  // ── 2. Site settings ──────────────────────────────────────────
  const settings = {
    site_name: 'Toriq Tools',
    site_tagline: 'Best Quality Tools',
    meta_description:
      'Toriq Tools — quality, durability and trust. Shop hand tools, cutting, measuring, ceramic and woodworking tools with cash on delivery across Bangladesh.',
    contact_email: 'toriqtools@gmail.com',
    phone_number: '+8801709264741',
    whatsapp_number: '8801709264741',
    facebook_url: 'https://www.facebook.com/share/14pcFpokFjS/',
    currency_code: 'BDT',
    currency_symbol: 'Tk',
  };
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...settings },
  });
  console.log('✅ Site settings');

  // ── 3. Categories ─────────────────────────────────────────────
  for (const [i, c] of CATEGORIES.entries()) {
    const exists = await prisma.category.findFirst({ where: { slug: c.slug } });
    if (!exists) {
      await prisma.category.create({
        data: { ...c, display_order: i, is_active: true, show_in_header: true, show_in_footer: i < 5 },
      });
    }
  }
  console.log(`✅ Categories (${CATEGORIES.length})`);

  // ── 4. Policy pages (unpublished drafts — write content in CMS) ──
  for (const p of PAGES) {
    await prisma.page.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, section: 'support', content: '', is_published: false, show_in_footer: true },
    });
  }
  console.log(`✅ Pages (${PAGES.length}, unpublished)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
