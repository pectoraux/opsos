/**
 * @kernel/scheduling/domain/recurrence — pure recurrence-rule expansion.
 *
 * `expandRecurrence` materialises a `RecurrenceRule` into concrete
 * `TemporalWindow` occurrences bounded by a `ScheduleWindow`. It is a PURE
 * data transformation: no I/O, no `Date.now()`, no `Math.random()` — it
 * operates solely on the epoch-millis numbers carried in by the caller.
 *
 * Supported RRULE fields (per the task contract — "keep it simple"):
 *   - `freq`      — second | minute | hour | day | week | month | year
 *   - `interval`  — step between consecutive occurrence starts (in `freq` units)
 *   - `count`     — maximum number of occurrences to generate (optional)
 *   - `until`     — upper bound (exclusive) on occurrence start epoch-millis
 *   - `byDays`    — weekday filter (RRULE-style codes: SU,MO,TU,WE,TH,FR,SA)
 *
 * Each occurrence produces a window of width = one `freq` unit, starting at
 * the occurrence start. For `freq: "month"` and `freq: "year"` the width is an
 * *approximation* (30 / 365 days) — calendaring libs handle DST / leap years;
 * this foundation deliberately trades precision for purity and simplicity.
 * Protocol-supplied schedulers may install a richer expander later.
 *
 * Overflow safety: expansion is capped at `MAX_EXPANSION` occurrences. If the
 * rule would yield more, the function returns `[]` (documented "overflow"
 * behaviour) so callers can detect the degenerate case rather than receiving a
 * truncated, silently-wrong result.
 */

import type {
  RecurrenceRule,
  ScheduleWindow,
  TemporalWindow,
} from "@kernel/shared-kernel";

/** Hard cap on the number of occurrences `expandRecurrence` will emit. */
export const MAX_EXPANSION = 1000;

/** Milliseconds per `freq` unit. Month/year are approximations (see file doc). */
const FREQ_MS: Readonly<Record<RecurrenceRule["freq"], number>> = Object.freeze({
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  year: 365 * 86_400_000,
});

/** Map JS `getUTCDay()` (0=Sun..6=Sat) → RRULE weekday code. */
const WEEKDAY_CODES: readonly string[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * Expand `rule` into concrete `TemporalWindow` occurrences within `window`.
 *
 * Semantics:
 *   - The first occurrence starts at `window.start`.
 *   - Each occurrence's window is `[start, start + freqUnitMs)`.
 *   - Subsequent occurrence starts are spaced `interval * freqUnitMs` apart.
 *   - An occurrence is emitted iff its start is `< window.end` AND `< until`
 *     (when `until` is provided) AND its weekday code is in `byDays` (when
 *     `byDays` is provided).
 *   - At most `count` occurrences are emitted (when `count` is provided).
 *
 * Overflow: if the rule would produce more than `MAX_EXPANSION` occurrences
 * before any terminating condition fires, returns `[]` (empty array) so the
 * caller can detect the degenerate input. The terminating conditions
 * (`count`, `until`, `window.end`) are evaluated before the cap, so a
 * well-bounded rule never hits the cap.
 *
 * @param rule   recurrence rule (freq, interval, count?, until?, byDays?)
 * @param window bounding schedule window (occurrences fit within `[start, end)`)
 * @returns readonly list of occurrence windows; `[]` on overflow or no matches
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  window: ScheduleWindow
): readonly TemporalWindow[] {
  if (rule.interval <= 0) {
    return [];
  }
  const freqMs = FREQ_MS[rule.freq];
  if (freqMs === undefined) {
    return [];
  }
  const stepMs = rule.interval * freqMs;
  const byDaysSet =
    rule.byDays && rule.byDays.length > 0 ? new Set(rule.byDays) : null;
  const hardEnd = Math.min(
    window.end,
    rule.until !== undefined ? rule.until : window.end
  );
  const maxCount = rule.count !== undefined ? rule.count : Number.POSITIVE_INFINITY;

  const out: TemporalWindow[] = [];
  let occurrenceStart = window.start;
  while (
    occurrenceStart < hardEnd &&
    out.length < maxCount &&
    out.length < MAX_EXPANSION
  ) {
    if (passesByDaysFilter(occurrenceStart, byDaysSet)) {
      out.push({
        start: occurrenceStart,
        end: occurrenceStart + freqMs,
        timezone: window.timezone,
      });
    }
    occurrenceStart += stepMs;
  }

  // Overflow detection: if we exited because of the MAX_EXPANSION cap AND a
  // terminating condition (count / until / window.end) hasn't yet fired, the
  // rule is degenerate — signal it by returning an empty array.
  if (
    out.length >= MAX_EXPANSION &&
    occurrenceStart < hardEnd &&
    maxCount > MAX_EXPANSION
  ) {
    return [];
  }
  return out;
}

/** Returns true iff `epochMs`'s UTC weekday is allowed by `byDaysSet`. */
function passesByDaysFilter(
  epochMs: number,
  byDaysSet: Set<string> | null
): boolean {
  if (byDaysSet === null) {
    return true;
  }
  // `new Date(epochMs)` is a pure conversion of epoch-millis to a Date; it
  // does NOT consult the wall clock (no `Date.now()`). Deterministic given ms.
  const weekdayCode = WEEKDAY_CODES[new Date(epochMs).getUTCDay()];
  return byDaysSet.has(weekdayCode);
}
