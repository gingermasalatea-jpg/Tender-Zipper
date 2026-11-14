import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';
import { displayValue } from '@/lib/forms';
import type { WorkOrder } from '@/lib/work-order';

/** Standard PDF fonts only support Latin-1; replace anything else so generation never fails. */
const safe = (s: unknown) => String(s ?? '').replace(/₹/g, 'Rs.').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '?');
const money = (n: number | string) => 'Rs. ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('work_order_detail', { p_contract: id });
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const wo = data as WorkOrder;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.118, 0.227, 0.541);
  const grey = rgb(0.39, 0.45, 0.55);
  const W = 595.28, H = 841.89, M = 48;

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (h: number) => {
    if (y - h < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const wrap = (text: string, f: PDFFont, size: number, width: number) => {
    const out: string[] = [];
    for (const para of safe(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(test, size) > width && line) {
          out.push(line);
          line = word;
        } else line = test;
      }
      out.push(line);
    }
    return out;
  };
  const text = (s: string, x: number, opts: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; width?: number } = {}) => {
    const f = opts.f ?? font, size = opts.size ?? 10;
    for (const line of wrap(s, f, size, opts.width ?? W - M - x)) {
      ensure(size + 4);
      page.drawText(line, { x, y: y - size, size, font: f, color: opts.color ?? rgb(0.06, 0.09, 0.16) });
      y -= size + 4;
    }
  };
  const gap = (n = 8) => (y -= n);
  const rule = () => {
    ensure(10);
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.85, 0.87, 0.9) });
    y -= 10;
  };

  // Header
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: brand });
  page.drawText('TENDER ZIPPER', { x: M, y: H - 45, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Post once. Get verified quotes. Zero commission.', { x: M, y: H - 64, size: 9, font, color: rgb(0.85, 0.89, 1) });
  page.drawText('WORK ORDER', { x: W - M - bold.widthOfTextAtSize('WORK ORDER', 14), y: H - 45, size: 14, font: bold, color: rgb(0.98, 0.75, 0.14) });
  page.drawText(safe(wo.code), { x: W - M - font.widthOfTextAtSize(safe(wo.code), 10), y: H - 62, size: 10, font, color: rgb(1, 1, 1) });
  y = H - 115;

  text(`Issued: ${new Date(wo.created_at).toLocaleDateString('en-IN')}    Tender: ${wo.tender.code}    Status: ${wo.status.toUpperCase()}`, M, { color: grey, size: 9 });
  gap(4);
  text(wo.tender.title, M, { f: bold, size: 14 });
  text(wo.tender.category_name, M, { color: grey });
  gap();

  // Parties
  const colW = (W - 2 * M - 20) / 2;
  const startY = y;
  text('BUYER', M, { f: bold, size: 9, color: grey, width: colW });
  text(wo.buyer.name ?? '-', M, { f: bold, width: colW });
  text([wo.tender.address, `${wo.tender.area_label ?? ''}, ${wo.tender.city_name} ${wo.tender.pincode ?? ''}`, wo.buyer.phone, wo.buyer.email].filter(Boolean).join('\n'), M, { width: colW, size: 9 });
  const leftEnd = y;
  y = startY;
  const x2 = M + colW + 20;
  text('VENDOR', x2, { f: bold, size: 9, color: grey, width: colW });
  text(wo.vendor.business_name, x2, { f: bold, width: colW });
  text([wo.vendor.contact_name, wo.vendor.gstin ? `GSTIN: ${wo.vendor.gstin}` : null, wo.vendor.phone, wo.vendor.email, wo.vendor.verified ? 'Verified on Tender Zipper' : null].filter(Boolean).join('\n'), x2, { width: colW, size: 9 });
  y = Math.min(y, leftEnd);
  gap();
  rule();

  // Price table
  text('AGREED PRICE', M, { f: bold, size: 9, color: grey });
  gap(2);
  const cols = [M, M + 250, M + 330, W - M];
  const row = (cells: string[], f = font) => {
    ensure(16);
    page.drawText(safe(cells[0]).slice(0, 60), { x: cols[0], y: y - 10, size: 9, font: f });
    page.drawText(safe(cells[1]), { x: cols[1], y: y - 10, size: 9, font: f });
    page.drawText(safe(cells[2]), { x: cols[2], y: y - 10, size: 9, font: f });
    const w = f.widthOfTextAtSize(safe(cells[3]), 9);
    page.drawText(safe(cells[3]), { x: cols[3] - w, y: y - 10, size: 9, font: f });
    y -= 16;
  };
  row(['Item', 'Qty', 'Rate', 'Amount'], bold);
  rule();
  for (const l of wo.quote.line_items) row([l.label, `${l.qty} ${l.unit}`, money(l.rate), money(l.amount ?? l.qty * l.rate)]);
  rule();
  row(['', '', 'Subtotal', money(wo.quote.subtotal)]);
  row(['', '', `GST ${Number(wo.quote.gst_percent)}%`, money(wo.quote.gst_amount)]);
  row(['', '', 'TOTAL', money(wo.quote.total)], bold);
  gap();
  text(`Timeline: ${wo.quote.timeline_days ? wo.quote.timeline_days + ' days' : '-'}     Warranty: ${wo.quote.warranty_months ? wo.quote.warranty_months + ' months' : '-'}     Preferred start: ${wo.tender.start_date ?? '-'}`, M, { size: 9 });
  text(`Payment terms: ${wo.quote.payment_terms || 'To be agreed directly between buyer and vendor'}`, M, { size: 9 });
  if (wo.quote.notes) text(`Vendor notes: ${wo.quote.notes}`, M, { size: 9 });
  gap();
  rule();

  // Scope
  text('SCOPE OF WORK', M, { f: bold, size: 9, color: grey });
  gap(2);
  for (const f of wo.tender.form_schema?.fields ?? []) {
    const v = wo.tender.form_data?.[f.key];
    if (f.type === 'items' && Array.isArray(v)) {
      text(`${f.label}:`, M, { f: bold, size: 9 });
      for (const r of v as Record<string, unknown>[]) text(`- ${(f.columns ?? []).map((c) => String(r[c.key] ?? '')).filter(Boolean).join(' | ')}`, M + 10, { size: 9 });
    } else {
      text(`${f.label}: ${displayValue(f, v)}`, M, { size: 9 });
    }
  }
  if (wo.tender.description) text(`Notes: ${wo.tender.description}`, M, { size: 9 });
  gap(16);

  // Signatures
  ensure(70);
  const sigY = y - 40;
  page.drawLine({ start: { x: M, y: sigY }, end: { x: M + 180, y: sigY }, thickness: 0.6, color: grey });
  page.drawLine({ start: { x: W - M - 180, y: sigY }, end: { x: W - M, y: sigY }, thickness: 0.6, color: grey });
  page.drawText('Buyer signature', { x: M, y: sigY - 12, size: 8, font, color: grey });
  page.drawText('Vendor signature & stamp', { x: W - M - 180, y: sigY - 12, size: 8, font, color: grey });
  y = sigY - 30;
  text('Tender Zipper is an intermediary platform. It is not a party to this agreement and charges no commission on this work. Payments are made directly between buyer and vendor.', M, { size: 7, color: grey });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${wo.code}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}
