/**
 * @kernel/integration-hub/infrastructure/in-memory-rate-limiter — the
 * reference `RateLimiter` implementation.
 *
 * Stores per-connector `RateLimit` state in a `Map<string, RateLimit>`.
 * Window starts are computed by integer division of `now` by the window size
 * (minute = 60_000, hour = 3_600_000, day = 86_400_000) — a pure function of
 * epoch-ms. When a window rolls over, its counter resets to zero.
 *
 * `check` is non-mutating: it returns `{ allowed, remaining, resetAt }`
 * computed from a hypothetical +1 to the current windows. `record` actually
 * consumes one unit. Both are pure functions of the caller-supplied `now`.
 *
 * `remaining` is the minimum remaining across the three windows; `resetAt` is
 * the end of whichever window is most exhausted (the one with the smallest
 * remaining).
 *
 * No `Date.now()`, no `Math.random()`.
 */

import type {
  RateCheckResult,
  RateLimit,
  RateLimiter,
  RateWindow,
} from "../domain";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export class InMemoryRateLimiter implements RateLimiter {
  private readonly limits = new Map<string, RateLimit>();

  configure(limit: RateLimit): void {
    this.limits.set(limit.connectorId, limit);
  }

  check(connectorId: string): RateCheckResult {
    const limit = this.limits.get(connectorId);
    if (!limit) {
      // No limit configured → unlimited.
      return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: 0 };
    }
    const window = limit.current;
    const minuteRemaining = Math.max(0, limit.maxPerMinute - window.minuteCount);
    const hourRemaining = Math.max(0, limit.maxPerHour - window.hourCount);
    const dayRemaining = Math.max(0, limit.maxPerDay - window.dayCount);

    const remaining = Math.min(
      minuteRemaining,
      hourRemaining,
      dayRemaining
    );
    const allowed = remaining > 0;

    // The most-exhausted window determines the reset time.
    let resetAt: number;
    if (remaining === minuteRemaining) {
      resetAt = window.minuteStart + MINUTE_MS;
    } else if (remaining === hourRemaining) {
      resetAt = window.hourStart + HOUR_MS;
    } else {
      resetAt = window.dayStart + DAY_MS;
    }
    return { allowed, remaining, resetAt };
  }

  record(connectorId: string, now: number): void {
    const limit = this.limits.get(connectorId);
    if (!limit) return;
    const rolled = rollWindows(limit.current, now);
    const updated: RateWindow = {
      minuteStart: rolled.minuteStart,
      minuteCount: rolled.minuteCount + 1,
      hourStart: rolled.hourStart,
      hourCount: rolled.hourCount + 1,
      dayStart: rolled.dayStart,
      dayCount: rolled.dayCount + 1,
    };
    this.limits.set(connectorId, { ...limit, current: updated });
  }

  get(connectorId: string): RateLimit | undefined {
    return this.limits.get(connectorId);
  }
}

/**
 * Roll the windows forward to `now`, resetting any window whose start has
 * passed. Returns a fresh `RateWindow` (does not mutate the input).
 */
function rollWindows(w: RateWindow, now: number): RateWindow {
  const minuteStart = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const hourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
  const dayStart = Math.floor(now / DAY_MS) * DAY_MS;

  return {
    minuteStart,
    minuteCount: minuteStart === w.minuteStart ? w.minuteCount : 0,
    hourStart,
    hourCount: hourStart === w.hourStart ? w.hourCount : 0,
    dayStart,
    dayCount: dayStart === w.dayStart ? w.dayCount : 0,
  };
}
