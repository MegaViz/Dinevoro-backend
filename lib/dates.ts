/**
 * Day boundaries are calculated in the restaurant's time zone (IST by default), not the
 * server's. The API runs in UTC on Render, so a plain setHours(0) would put "today" at
 * 05:30 IST and mix expenses and orders from neighbouring days.
 */
export const RESTAURANT_TIME_ZONE = process.env.RESTAURANT_TIME_ZONE || "Asia/Kolkata";

const DAY_MS = 24 * 60 * 60 * 1000;

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Milliseconds the time zone is ahead of UTC at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function startOfDay(date: Date, timeZone = RESTAURANT_TIME_ZONE) {
  const p = zonedParts(date, timeZone);
  const utcMidnight = Date.UTC(p.year, p.month - 1, p.day);
  return new Date(utcMidnight - zoneOffsetMs(new Date(utcMidnight), timeZone));
}

export function endOfDay(date: Date, timeZone = RESTAURANT_TIME_ZONE) {
  const start = startOfDay(date, timeZone);
  return new Date(startOfDay(new Date(start.getTime() + DAY_MS + 2 * 60 * 60 * 1000), timeZone).getTime() - 1);
}

export function startOfMonth(date: Date, timeZone = RESTAURANT_TIME_ZONE) {
  const p = zonedParts(date, timeZone);
  const utcFirst = Date.UTC(p.year, p.month - 1, 1);
  return new Date(utcFirst - zoneOffsetMs(new Date(utcFirst), timeZone));
}

/** Start of the month `n` months before the month containing `date`. */
export function addMonths(date: Date, n: number, timeZone = RESTAURANT_TIME_ZONE) {
  const p = zonedParts(date, timeZone);
  const utcFirst = Date.UTC(p.year, p.month - 1 + n, 1, 12);
  return startOfMonth(new Date(utcFirst), timeZone);
}

export function endOfMonth(date: Date, timeZone = RESTAURANT_TIME_ZONE) {
  return new Date(addMonths(date, 1, timeZone).getTime() - 1);
}

export function daysAgo(n: number, from = new Date()) {
  return new Date(from.getTime() - n * DAY_MS);
}

/** Calendar date (YYYY-MM-DD) in the restaurant time zone. */
export function localDateKey(date: Date, timeZone = RESTAURANT_TIME_ZONE) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions, timeZone = RESTAURANT_TIME_ZONE) {
  return date.toLocaleDateString("en-IN", { timeZone, ...options });
}

export function localHour(date: Date, timeZone = RESTAURANT_TIME_ZONE) {
  return zonedParts(date, timeZone).hour;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
