import 'server-only';

/** Sends an email through Resend's HTTP API. Returns false when email is not configured. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'Tender Zipper <no-reply@tenderzipper.in>', to, subject, html }),
  });
  return res.ok;
}

export function notificationEmail(title: string, body: string | null, link: string | null) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const button = link
    ? `<p style="margin:24px 0"><a href="${appUrl}${link}" style="background:#1E3A8A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open in Tender Zipper</a></p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
    <h2 style="color:#1E3A8A;margin-bottom:4px">Tender Zipper</h2>
    <p style="color:#64748b;margin-top:0">Post once. Get verified quotes. Zero commission.</p>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(body ?? '')}</p>${button}
    <p style="color:#94a3b8;font-size:12px">You received this because you use Tender Zipper.</p></div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
