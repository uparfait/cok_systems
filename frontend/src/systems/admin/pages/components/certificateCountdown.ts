export interface CountdownParts {
  expired: boolean;
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WARNING_DAYS = 30;

const days_in_month = (year: number, month_index: number) => new Date(Date.UTC(year, month_index + 1, 0)).getUTCDate();

export function add_months_utc(date: Date, count: number): Date {
  const total = date.getUTCMonth() + count;
  const year = date.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), days_in_month(year, month));
  return new Date(Date.UTC(year, month, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

const EMPTY: CountdownParts = { expired: true, years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

export function countdown_parts(not_after: Date | string | number | null | undefined, now: Date | number = Date.now()): CountdownParts | null {
  if (not_after === null || not_after === undefined || not_after === '') return null;
  const end = new Date(not_after).getTime();
  const start = new Date(now).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  if (end <= start) return EMPTY;
  let cursor = new Date(start);
  let years = 0;
  let months = 0;
  while (add_months_utc(cursor, 12).getTime() <= end) {
    cursor = add_months_utc(cursor, 12);
    years += 1;
  }
  while (add_months_utc(cursor, 1).getTime() <= end) {
    cursor = add_months_utc(cursor, 1);
    months += 1;
  }
  let rest = Math.floor((end - cursor.getTime()) / 1000);
  const days = Math.floor(rest / 86400);
  rest -= days * 86400;
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  const seconds = rest - minutes * 60;
  return { expired: false, years, months, days, hours, minutes, seconds };
}

export function format_countdown(not_after: Date | string | number | null | undefined, now: Date | number = Date.now()): string {
  const parts = countdown_parts(not_after, now);
  if (!parts) return 'unknown';
  if (parts.expired) return 'expired';
  const units: Array<[number, string]> = [
    [parts.years, 'y'],
    [parts.months, 'm'],
    [parts.days, 'd'],
    [parts.hours, 'h'],
    [parts.minutes, 'M'],
    [parts.seconds, 's'],
  ];
  const text = units
    .filter(([count]) => count > 0)
    .map(([count, unit]) => `${count}${unit}`)
    .join('');
  return text || '0s';
}

export function days_until(not_after: Date | string | number | null | undefined, now: Date | number = Date.now()): number | null {
  if (not_after === null || not_after === undefined || not_after === '') return null;
  const end = new Date(not_after).getTime();
  const start = new Date(now).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.floor((end - start) / DAY_MS);
}

export type CountdownTone = 'unknown' | 'danger' | 'ok';

export function countdown_tone(not_after: Date | string | number | null | undefined, now: Date | number = Date.now()): CountdownTone {
  const left = days_until(not_after, now);
  if (left === null) return 'unknown';
  return left < WARNING_DAYS ? 'danger' : 'ok';
}
