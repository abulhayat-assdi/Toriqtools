import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/admin-auth';

// Store details printed on the Steadfast courier label (merchant name + Steadfast merchant ID).
export async function GET(req: NextRequest) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { site_name: true },
  });
  return NextResponse.json({
    site_name: settings?.site_name || 'Toriq Tools',
    merchant_id: process.env.STEADFAST_MERCHANT_ID || '',
  });
}
