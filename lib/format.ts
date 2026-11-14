import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export function rupees(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === '') return '—';
  return inr.format(Number(n));
}

export function budgetLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return 'Not disclosed';
  if (min != null && max != null) return `${rupees(min)} – ${rupees(max)}`;
  return min != null ? `From ${rupees(min)}` : `Up to ${rupees(max)}`;
}

const IST = 'Asia/Kolkata';
export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}
export function dateOnly(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

export function publicMediaUrl(bucket: string, path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** Turns a Supabase/Postgres error into a short message for the user. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message);
  return 'Something went wrong. Please try again.';
}
