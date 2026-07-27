/**
 * @kernel/shared-kernel — versioning & time primitives.
 *
 * `Version` is the monotonic per-stream counter used for optimistic
 * concurrency. `ClockTime` is an epoch-millis number sourced exclusively from
 * `RuntimeClock` — never from `Date.now()` inside the deterministic core.
 */

/** Monotonic per-stream event version (1-based after first event). */
export type Version = number;

export const NO_VERSION: Version = 0;

/** A stream version meaning "the stream must not yet exist". */
export const EMPTY_STREAM: Version = 0;

/** A stream version meaning "append regardless of current version". */
export const ANY_VERSION: Version = -1;

/** Epoch milliseconds. Always sourced from RuntimeClock inside the core. */
export type ClockTime = number;

/** A monotonically increasing logical tick for ordering within an execution. */
export type LogicalTick = number;

export interface Versioned {
  readonly version: Version;
}

/** Compare two versions for ordering. */
export function compareVersion(a: Version, b: Version): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Advance a version by one. Pure helper. */
export function nextVersion(v: Version): Version {
  return v + 1;
}
