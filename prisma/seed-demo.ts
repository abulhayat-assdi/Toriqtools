import { PrismaClient } from '@prisma/client';

// DEMO DATA ONLY — for local preview. Run: npm run seed && node --env-file=.env.local --no-warnings prisma/seed-demo.ts
const prisma = new PrismaClient();
const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

const cats = [
  { name: 'Hand Tools', slug: 'hand-tools', img: 'photo-1530124566582-a618bc2615dc' },
  { name: 'Power Tools', slug: 'power-tools', img: 'photo-1504148455328-c376907d081c' },
  { name: 'Measuring', slug: 'measuring', img: 'photo-1581783898377-1c85bf937427' },
  { name: 'Safety Gear', slug: 'safety-gear', img: 'photo-1578874691223-64558a3ca096' },
];

const products = [
  ['Claw Hammer 16oz', 'hand-tools', '650', '850', 'photo-1586864387967-d02ef85d93e8'],
  ['Screwdriver Set 12pc', 'hand-tools', '720', '950', 'photo-1572981779307-38b8cabb2407'],
  ['Adjustable Wrench', 'hand-tools', '480', '600', 'photo-1581147036324-c1c1c5ee3f6c'],
  ['Cordless Drill 20V', 'power-tools', '5800', '7200', 'photo-1504148455328-c376907d081c'],
  ['Angle Grinder 850W', 'power-tools', '4200', '5000', 'photo-1572981779307-38b8cabb2407'],
  ['Jigsaw 650W', 'power-tools', '3600', '4300', 'photo-1530124566582-a618bc2615dc'],
  ['Steel Tape 5m', 'measuring', '280', '350', 'photo-1581783898377-1c85bf937427'],
  ['Digital Caliper', 'measuring', '1450', '1800', 'photo-1581092160562-40aa08e78837'],
  ['Laser Level', 'measuring', '2400', '3000', 'photo-1581092918056-0c4c3acd3789'],
  ['Safety Helmet', 'safety-gear', '550', '700', 'photo-1578874691223-64558a3ca096'],
  ['Work Gloves', 'safety-gear', '320', '400', 'photo-1504917595217-d4dc5ebe6122'],
  ['Safety Goggles', 'safety-gear', '260', '350', 'photo-1581092335397-9583eb92d232'],
];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function main() {
  await prisma.category.deleteMany();
  await prisma.category.createMany({
    data: cats.map((c, i) => ({ name: c.name, slug: c.slug, image_url: u(c.img), is_active: true, show_in_header: true, show_in_footer: true, display_order: i })),
  });

  for (const [i, [name, category, price, original, img]] of products.entries()) {
    const slug = slugify(name);
    const discount = `${Math.round((1 - Number(price) / Number(original)) * 100)}%`;
    const data = {
      name, slug, category, price, original_price: original, discount,
      detail: 'Durable, workshop-ready quality.',
      description: `<p>${name} — a demo product for previewing the Toriq Tools storefront. Built for daily professional use.</p>`,
      media_urls: [u(img)], is_available: true, is_featured: i < 6, display_order: i,
    };
    await prisma.product.upsert({ where: { slug }, update: data, create: data });
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1, site_name: 'Toriq Tools', site_tagline: 'Quality tools for every job',
      meta_description: 'Hand tools, power tools and safety gear delivered across Bangladesh.',
      contact_email: 'hello@toriqtools.com', whatsapp_number: '8801700000000', phone_number: '+8801700000000',
      instagram_url: 'https://instagram.com/toriqtools', facebook_url: 'https://facebook.com/toriqtools',
    },
  });

  const banners = [
    { id: 'b1', image_url: u('photo-1504148455328-c376907d081c').replace('w=900', 'w=1600'), link: '/collections' },
    { id: 'b2', image_url: u('photo-1530124566582-a618bc2615dc').replace('w=900', 'w=1600'), link: '/collections' },
  ];
  const home = { banners, ticker_items: ['Free delivery over Tk 5000', 'Cash on delivery available', '7-day easy returns'], data: { hero_text: {} } };
  await prisma.homeConfig.upsert({ where: { id: 1 }, update: home, create: { id: 1, ...home } });

  await prisma.footerConfig.upsert({
    where: { id: 1 }, update: {},
    create: { id: 1, columns: [{ id: 'c1', heading: 'Help', links: [{ label: 'Delivery Info' }, { label: 'Returns' }] }], privacy: 'Privacy Policy', terms: 'Terms & Conditions' },
  });

  await prisma.testimonial.deleteMany();
  await prisma.testimonial.createMany({
    data: [
      ['Rahim Uddin', 'Great quality drill, arrived in two days. Highly recommended!'],
      ['Sabbir Hossain', 'Genuine products at a fair price. Will order again.'],
      ['Nusrat Jahan', 'Perfect tools for my workshop. Packaging was excellent.'],
    ].map(([name, quote], i) => ({ type: 'review', name, quote, rating: 5, display_order: i })),
  });

  await prisma.coupon.upsert({
    where: { code: 'DEMO10' }, update: {},
    create: { code: 'DEMO10', type: 'percent', value: 10, max_uses: 1000 },
  });

  console.log('✅ Demo data loaded');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
