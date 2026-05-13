// lib/vendorSchedule.ts
// Shared logic for computing vendor open/closed status.
//
// Supports two modes:
//   1. day_schedule (new) — JSONB array of per-day overrides
//   2. opens_at / closes_at (legacy) — single global window, applied every day
//
// day_schedule shape:
//   { day: 0-6 (0=Sun), opens_at: "HH:MM" | null, closes_at: "HH:MM" | null, closed: boolean }[]
//
// Resolution order for a given day:
//   - If day_schedule exists and has an entry for today → use it (closed flag or custom hours)
//   - Otherwise fall back to global opens_at / closes_at

export type DayEntry = {
  day: number;      // 0 = Sunday … 6 = Saturday
  opens_at: string | null;
  closes_at: string | null;
  closed: boolean;
};

export type VendorSchedule = {
  opens_at?: string | null;
  closes_at?: string | null;
  day_schedule?: DayEntry[] | null;
};

/** WAT = UTC+1. Returns current {watMinutes, watDay} */
function nowWAT(): { watMinutes: number; watDay: number } {
  const now = new Date();
  const watTotalMins = (now.getUTCHours() + 1) * 60 + now.getUTCMinutes();
  // WAT day — account for midnight rollover
  const watHours = Math.floor(watTotalMins / 60) % 24;
  const watMinutes = watTotalMins % (24 * 60);
  // Day calculation: if UTC+1 crosses midnight forward, watDay is tomorrow
  const baseDay = now.getUTCDay();
  const watDay = watTotalMins >= 24 * 60 ? (baseDay + 1) % 7 : baseDay;
  return { watMinutes: watTotalMins % (24 * 60), watDay };
}

function windowOpen(opensAt: string, closesAt: string, watMinutes: number): boolean {
  const [oh, om] = opensAt.split(':').map(Number);
  const [ch, cm] = closesAt.split(':').map(Number);
  const openMin  = oh * 60 + (om ?? 0);
  const closeMin = ch * 60 + (cm ?? 0);
  if (closeMin <= openMin) return watMinutes >= openMin || watMinutes < closeMin;
  return watMinutes >= openMin && watMinutes < closeMin;
}

/**
 * Returns true if the vendor is open right now, false if closed, null if unknown.
 * Accepts any object with opens_at, closes_at, and/or day_schedule.
 */
export function isOpenNow(vendor: VendorSchedule): boolean | null {
  const { watMinutes, watDay } = nowWAT();
  const schedule = vendor.day_schedule;

  if (Array.isArray(schedule) && schedule.length > 0) {
    const entry = schedule.find((e) => e.day === watDay);

    if (entry) {
      if (entry.closed) return false;
      if (entry.opens_at && entry.closes_at) {
        return windowOpen(entry.opens_at, entry.closes_at, watMinutes);
      }
      // Entry exists but no hours set → fall through to global
    }
  }

  // Legacy fallback
  if (vendor.opens_at && vendor.closes_at) {
    return windowOpen(vendor.opens_at, vendor.closes_at, watMinutes);
  }

  return null;
}

/** Returns the hours string for a given day, or null if not set */
export function hoursForDay(vendor: VendorSchedule, day: number): string | null {
  const schedule = vendor.day_schedule;

  if (Array.isArray(schedule) && schedule.length > 0) {
    const entry = schedule.find((e) => e.day === day);
    if (entry) {
      if (entry.closed) return 'Closed';
      if (entry.opens_at && entry.closes_at) return `${fmt(entry.opens_at)} – ${fmt(entry.closes_at)}`;
    }
  }

  if (vendor.opens_at && vendor.closes_at) return `${fmt(vendor.opens_at)} – ${fmt(vendor.closes_at)}`;
  return null;
}

/** "09:00" → "9am", "13:30" → "1:30pm" */
function fmt(t: string): string {
  const [h, m] = t.split(':');
  const hour   = parseInt(h, 10);
  const minute = m ?? '00';
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === '00' ? `${display}${suffix}` : `${display}:${minute}${suffix}`;
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;