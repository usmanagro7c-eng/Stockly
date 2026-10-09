import { format, isValid, parseISO } from "date-fns";

export function formatMoney(value: number, symbol = "Rs."): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${safe < 0 ? "-" : ""}${symbol} ${abs}`;
}

export function formatSigned(value: number, symbol = "Rs."): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : "-"}${symbol} ${Math.abs(safe).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatUnits(value: number): string {
  return Math.round(Number.isFinite(value) ? value : 0).toLocaleString("en-US");
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function safeDate(value?: string): Date | null {
  if (!value) return null;

  if (value.length > 10) return validOrNull(new Date(value));

  // Fast path for plain YYYY-MM-DD. date-fns' parseISO is comparatively slow
  // and this runs over every row when building inventory.
  const m = ISO_DATE.exec(value);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    // Rejects overflow such as 2026-02-31.
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  return validOrNull(parseISO(value));
}

function validOrNull(d: Date): Date | null {
  return isValid(d) ? d : null;
}

export function formatDate(value?: string): string {
  const d = safeDate(value);
  return d ? format(d, "dd MMM yyyy") : "—";
}

export function formatDateTime(value?: string): string {
  const d = safeDate(value);
  return d ? format(d, "dd MMM yyyy, HH:mm") : "—";
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function toNumber(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
