/**
 * DATE RANGE MODEL (Phase 3, Section 16)
 * ---------------------------------------------------------------------------
 * TIMEZONE ASSUMPTION: every date in this app is stored and compared as
 * an ISO 8601 UTC string (e.g. "2026-08-22T00:00:00.000Z"). "Today",
 * "this week", and "this month" are computed against the server's UTC
 * clock, not the business owner's local timezone. For an MVP serving a
 * single region this is a simplification worth being explicit about
 * rather than silently getting it wrong — a future phase should resolve
 * ranges using the business's own timezone once that concept exists.
 *
 * Ranges are half-open on the string comparison: `from <= date <= to`,
 * where `to` is set to the last instant of the range so date-only
 * comparisons behave intuitively.
 * ------------------------------------------------------------------------ */

export type DateRange = { from: string; to: string };

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
}

export function todayRange(now: Date = new Date()): DateRange {
  return {
    from: startOfUtcDay(now).toISOString(),
    to: endOfUtcDay(now).toISOString(),
  };
}

/** Monday-start week, per ISO 8601 convention. */
export function thisWeekRange(now: Date = new Date()): DateRange {
  const day = now.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    from: startOfUtcDay(monday).toISOString(),
    to: endOfUtcDay(sunday).toISOString(),
  };
}

export function thisMonthRange(now: Date = new Date()): DateRange {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: startOfUtcDay(first).toISOString(),
    to: endOfUtcDay(last).toISOString(),
  };
}

export function customRange(fromIso: string, toIso: string): DateRange {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range.");
  }
  const start = startOfUtcDay(from);
  const end = endOfUtcDay(to);
  if (start.getTime() > end.getTime()) {
    throw new Error("Start date must not be after end date.");
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

export type RangePreset = "today" | "week" | "month" | "custom";

export function resolveRange(
  preset: RangePreset,
  custom?: { from: string; to: string }
): DateRange {
  switch (preset) {
    case "today":
      return todayRange();
    case "week":
      return thisWeekRange();
    case "month":
      return thisMonthRange();
    case "custom":
      if (!custom) throw new Error("Custom range requires from/to dates.");
      return customRange(custom.from, custom.to);
  }
}

/**
 * PREVIOUS-PERIOD COMPARISON (Phase 4)
 * ---------------------------------------------------------------------------
 * Returns the immediately preceding period of the same duration, used to
 * compare e.g. "this month" against "last month" for growth/decline
 * findings. Duration is measured in whole days (inclusive), so a 31-day
 * "this month" is compared against the preceding 31 days — this is a
 * deliberate simplification (not calendar-month-aware, e.g. "August"
 * isn't compared against "July" specifically but against the 31 days
 * immediately before August 1st) chosen for determinism: it works
 * identically for calendar presets and arbitrary custom ranges alike,
 * with no special-casing.
 * ------------------------------------------------------------------------ */
export function previousEquivalentRange(range: DateRange): DateRange {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const durationMs = to.getTime() - from.getTime();

  const previousTo = new Date(from.getTime() - 1); // the instant just before `from`
  const previousFrom = new Date(previousTo.getTime() - durationMs);

  return { from: previousFrom.toISOString(), to: previousTo.toISOString() };
}
