import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { verifyAdminRequest } from '@/lib/admin-auth';

// Browser tab icon (favicon) — stored separately from the site logo so the two
// can be changed independently.
export async function POST(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return NextResponse.json({ error: `আইকন সাইজ অনেক বড় (${sizeMB}MB)। সর্বোচ্চ ৫MB পর্যন্ত আপলোড করা যাবে।` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  // uploads/site-favicon.png persists via the Docker volume; public/favicon.png is served directly
  await writeFile(join(uploadsDir, 'site-favicon.png'), buffer);
  await writeFile(join(process.cwd(), 'public', 'favicon.png'), buffer);

  const version = Date.now();
  await writeFile(join(uploadsDir, 'favicon-version.json'), JSON.stringify({ v: version }));

  return NextResponse.json({ success: true, v: version });
}
