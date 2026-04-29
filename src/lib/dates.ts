const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function assertDateOnly(value: string, label = "Date"): string {
  if (!isDateOnly(value)) {
    throw new Error(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  return value;
}

export function assertDateOnlyOnOrAfter(
  value: string,
  min: string,
  label = "Date"
): string {
  assertDateOnly(value, label);
  assertDateOnly(min, "Minimum date");
  if (value < min) {
    throw new Error(`${label} cannot be in the past`);
  }
  return value;
}

export function addDaysIso(iso: string, days: number): string {
  assertDateOnly(iso);
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    throw new Error("Days must be an integer");
  }
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function dateOnlyToUtcIso(iso: string): string {
  assertDateOnly(iso);
  return `${iso}T00:00:00.000Z`;
}
