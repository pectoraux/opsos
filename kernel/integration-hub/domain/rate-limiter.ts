/**
 * @kernel/integration-hub/domain/rate-limiter — the RateLimit primitive and
 * the RateLimiter port.
 *
 * A `RateLimit` is the per-connector rate-limit configuration: maximum
 * requests per minute / hour / day. `RateWindow` is the rolling window state
 * (counts + window-start timestamps) used to enforce those limits.
 *
 * The `RateLimiter` PORT exposes two operations:
 *   - `check(connectorId)` — is the next request allowed? Returns
 *     `{ allowed, remaining, resetAt }` WITHOUT mutating state.
 *   - `record(connectorId, now)` — actually consume one unit of capacity.
 *
 * Callers SHOULD `check` first, then dispatch, then `record` on success (or
 * `record` first to be conservative — the contract permits either order).
 *
 * Determinism: every timestamp flows from the caller's `now`. Window starts
 * are computed by integer division of `now` by the window size — a pure
 * function of epoch-ms. No `Date.now()` / `Math.random()`.
 */

/** Per-connector rate-limit configuration. */
export interface RateLimit {
  readonly connectorId: string;
  readonly maxPerMinute: number;
  readonly maxPerHour: number;
  readonly maxPerDay: number;
  /** Current rolling-window state. */
  readonly current: RateWindow;
}

/** Rolling-window counters for minute / hour / day. */
export interface RateWindow {
  /** Epoch-ms start of the current minute window. */
  readonly minuteStart: number;
  readonly minuteCount: number;
  /** Epoch-ms start of the current hour window. */
  readonly hourStart: number;
  readonly hourCount: number;
  /** Epoch-ms start of the current day window. */
  readonly dayStart: number;
  readonly dayCount: number;
}

/** The result of a `check` call. */
export interface RateCheckResult {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Epoch-ms when the most-exhausted window resets. */
  readonly resetAt: number;
}

/**
 * The port implemented by `InMemoryRateLimiter`. `check` is non-mutating;
 * `record` consumes one unit of capacity. Both are pure functions of the
 * caller-supplied `now`.
 */
export interface RateLimiter {
  /**
   * Configure (or replace) the rate-limit for a connector. Idempotent.
   */
  configure(limit: RateLimit): void;
  /**
   * Non-mutating check: is the next request allowed? Returns the remaining
   * capacity across all three windows and the reset time of the most
   * exhausted window.
   */
  check(connectorId: string): RateCheckResult;
  /** Consume one unit of capacity for the connector. */
  record(connectorId: string, now: number): void;
  /** Read the current rate-limit state for a connector (or undefined). */
  get(connectorId: string): RateLimit | undefined;
}
