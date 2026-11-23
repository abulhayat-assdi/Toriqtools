'use client';

// Builds the Steadfast courier label (sticker) for an order and downloads it as an
// A4 PDF with the label centred on the page. The label is rendered as HTML first and
// captured to an image, so Bengali names/addresses render correctly.

import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export type CourierLabelOrder = {
  order_id: string;
  customer_name: string;
  phone: string;
  address: string;
  total: number;
  payment_method: string;
  consignment_id?: string | null;
  tracking_code?: string | null;
  items?: { product_name: string; quantity: number; size?: string | null; color?: string | null }[];
};

const LABEL_WIDTH_PX = 560;
const LABEL_WIDTH_MM = 110;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

let cachedInfo: { site_name: string; merchant_id: string } | null = null;

async function getLabelInfo() {
  if (cachedInfo) return cachedInfo;
  const res = await fetch('/api/admin/orders/label-info');
  if (!res.ok) throw new Error('Store info load failed');
  cachedInfo = await res.json();
  return cachedInfo!;
}

async function getLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png', { cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function barcodeSvg(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    height: 70,
    width: 3,
    background: '#ffffff',
    lineColor: '#000000',
  });
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.width = '100%';
  svg.style.height = '70px';
  svg.style.display = 'block';
  return svg.outerHTML;
}

function printedAt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${p(h)}:${p(d.getMinutes())}${ampm}`;
}

function itemsText(order: CourierLabelOrder): string {
  return (order.items || [])
    .map(i => {
      const variant = [i.size, i.color].filter(Boolean).join(', ');
      return `${i.product_name}${variant ? ` (${variant})` : ''} x${i.quantity}`;
    })
    .join(', ');
}

function buildLabelHtml(
  order: CourierLabelOrder,
  info: { site_name: string; merchant_id: string },
  logo: string | null,
  qr: string,
): string {
  const cid = order.consignment_id || '';
  const cod = order.payment_method === 'cash' ? Number(order.total) : 0;
  const codText = `৳ ${cod.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const items = itemsText(order);

  const muted = '#7a7a7a';
  const row = (label: string, value: string) => `
    <tr>
      <td style="color:${muted};font-weight:600;font-size:14px;letter-spacing:0.4px;padding:4px 0;width:100px;vertical-align:top;">${label}</td>
      <td style="color:#111;font-weight:700;font-size:15px;padding:4px 0;word-break:break-word;">${value}</td>
    </tr>`;
  const metaRow = (label: string, value: string) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;">
      <span style="color:${muted};font-weight:600;font-size:14px;letter-spacing:0.6px;white-space:nowrap;">${label}</span>
      <span style="color:#111;font-weight:800;font-size:15px;white-space:nowrap;margin-left:12px;">${value}</span>
    </div>`;
  const rule = (w = 2) => `<div style="height:${w}px;background:#111;margin:0;"></div>`;

  const logoBox = logo
    ? `<img src="${logo}" style="width:80px;height:80px;object-fit:contain;border-radius:10px;border:1.5px solid #cfcfcf;padding:4px;background:#fff;" />`
    : `<div style="width:80px;height:80px;border-radius:10px;border:1.5px solid #bdbdbd;background:#f3f3f3;display:flex;align-items:center;justify-content:center;text-align:center;color:#777;font-size:11px;">no image<br/>found</div>`;

  return `
  <div style="width:${LABEL_WIDTH_PX}px;box-sizing:border-box;background:#fff;border:2px solid #555;border-radius:4px;padding:18px 22px 12px;font-family:Arial,Helvetica,'Noto Sans Bengali','Hind Siliguri',sans-serif;color:#111;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;">
      ${logoBox}
      <div style="text-align:right;padding-top:10px;flex:1;margin-left:16px;">
        <div style="font-size:22px;font-weight:800;color:#111;">${esc(info.site_name)}</div>
        ${info.merchant_id ? `<div style="font-size:15px;color:${muted};margin-top:6px;white-space:nowrap;">Merchant ID: ${esc(info.merchant_id)}</div>` : ''}
      </div>
    </div>
    ${rule()}
    <div style="padding:10px 0 8px;">
      ${barcodeSvg(cid)}
      <div style="text-align:center;font-size:17px;font-weight:800;letter-spacing:9px;color:#1e3a5f;margin-top:6px;">${esc(cid)}</div>
    </div>
    ${rule()}
    <div style="display:flex;align-items:center;gap:14px;padding:10px 0;">
      <img src="${qr}" style="width:112px;height:112px;display:block;" />
      <div style="width:2px;align-self:stretch;background:#cfcfcf;"></div>
      <div style="flex:1;">
        ${metaRow('INVOICE', esc(order.order_id))}
        ${metaRow('DELIVERY', 'Home')}
      </div>
    </div>
    ${rule()}
    <table style="width:100%;border-collapse:collapse;margin:10px 0 12px;">
      ${row('NAME', esc(order.customer_name))}
      ${row('PHONE', esc(order.phone))}
      ${row('ADDRESS', esc(order.address))}
      ${items ? row('ITEM', esc(items)) : ''}
    </table>
    <div style="border:2px solid #111;border-radius:2px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:16px;font-weight:700;letter-spacing:0.4px;white-space:nowrap;">CASH ON DELIVERY</span>
      <span style="font-size:22px;font-weight:900;white-space:nowrap;">${codText}</span>
    </div>
    <div style="height:2px;background:#111;margin:12px 0 8px;"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:${muted};">
      <span style="white-space:nowrap;">Printed: ${printedAt(new Date())}</span>
      <span style="display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#16a34a;"></span>
        <span style="color:#111;font-weight:800;font-size:13px;">steadfast</span>
        <span>steadfast.com.bd</span>
      </span>
    </div>
  </div>`;
}

export async function downloadCourierLabel(order: CourierLabelOrder): Promise<void> {
  if (!order.consignment_id) throw new Error('এই অর্ডারের কোনো Consignment ID নেই');

  const [info, logo] = await Promise.all([getLabelInfo(), getLogoDataUrl()]);
  const qrValue = order.tracking_code
    ? `https://steadfast.com.bd/t/${order.tracking_code}`
    : order.consignment_id;
  const qr = await QRCode.toDataURL(qrValue, { margin: 0, width: 336, errorCorrectionLevel: 'M' });

  // Render off-screen so it doesn't flash in the admin UI
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;background:#fff;';
  host.innerHTML = buildLabelHtml(order, info, logo, qr);
  document.body.appendChild(host);
  const el = host.firstElementChild as HTMLElement;

  try {
    await Promise.all(
      Array.from(el.querySelectorAll('img')).map(img => img.decode().catch(() => undefined)),
    );
    if (document.fonts?.ready) await document.fonts.ready;

    const dataUrl = await htmlToImage.toPng(el, {
      pixelRatio: 3,
      backgroundColor: '#ffffff',
      width: el.offsetWidth,
      height: el.offsetHeight,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = LABEL_WIDTH_MM;
    const imgH = (el.offsetHeight * imgW) / el.offsetWidth;
    pdf.addImage(dataUrl, 'PNG', (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH, undefined, 'FAST');
    pdf.save(`Steadfast_${order.order_id}_${order.consignment_id}.pdf`);
  } finally {
    host.remove();
  }
}
