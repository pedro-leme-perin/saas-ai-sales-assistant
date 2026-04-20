// =============================================
// ⏰ Cron helper (Session 51)
// =============================================
// Preset cron expressions for scheduled exports. Times are UTC-anchored.
// Accepted forms:
//   "hourly"                  → next hour :00 UTC
//   "daily:HH:MM"             → next UTC occurrence of HH:MM
//   "weekly:DOW:HH:MM"        → DOW = 0..6 (Sun..Sat) UTC
//   "monthly:DOM:HH:MM"       → DOM = 1..28 UTC
// The timezone field stored alongside is display-only for v1.

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAILY_RE = /^daily:([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKLY_RE = /^weekly:([0-6]):([01]\d|2[0-3]):([0-5]\d)$/;
const MONTHLY_RE = /^monthly:(0?[1-9]|1\d|2[0-8]):([01]\d|2[0-3]):([0-5]\d)$/;

export function validateCron(expression: string): void {
  if (expression === 'hourly') return;
  if (DAILY_RE.test(expression)) return;
  if (WEEKLY_RE.test(expression)) return;
  if (MONTHLY_RE.test(expression)) return;
  throw new Error(`Invalid cron expression: ${expression}`);
}

export function computeNextRunAt(expression: string, from: Date): Date {
  const baseMs = from.getTime();
  if (expression === 'hourly') {
    const d = new Date(baseMs);
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() + 1);
    return d;
  }

  const daily = DAILY_RE.exec(expression);
  if (daily) {
    const hh = Number(daily[1]);
    const mm = Number(daily[2]);
    const d = new Date(baseMs);
    d.setUTCHours(hh, mm, 0, 0);
    if (d.getTime() <= baseMs) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  const weekly = WEEKLY_RE.exec(expression);
  if (weekly) {
    const dow = Number(weekly[1]);
    const hh = Number(weekly[2]);
    const mm = Number(weekly[3]);
    const d = new Date(baseMs);
    d.setUTCHours(hh, mm, 0, 0);
    const diff = (dow - d.getUTCDay() + 7) % 7;
    d.setUTCDate(d.getUTCDate() + diff);
    if (d.getTime() <= baseMs) d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }

  const monthly = MONTHLY_RE.exec(expression);
  if (monthly) {
    const dom = Number(monthly[1]);
    const hh = Number(monthly[2]);
    const mm = Number(monthly[3]);
    const d = new Date(baseMs);
    d.setUTCDate(dom);
    d.setUTCHours(hh, mm, 0, 0);
    if (d.getTime() <= baseMs) {
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCDate(dom);
      d.setUTCHours(hh, mm, 0, 0);
    }
    return d;
  }

  throw new Error(`Invalid cron expression: ${expression}`);
}

export const PRESET_EXAMPLES = [
  'hourly',
  'daily:08:00',
  'daily:20:00',
  'weekly:1:08:00',
  'monthly:1:08:00',
];

export { TIME_RE };
