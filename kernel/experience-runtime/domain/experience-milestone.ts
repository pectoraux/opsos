/**
 * @kernel/experience-runtime/domain/experience-milestone — the Milestone +
 * MilestoneCriteria value objects and the MilestoneTracker PORT.
 *
 * A milestone is a checkpoint anchored to a journey stage. It is `pending`
 * until its criteria are satisfied, then `achieved` (with an `achievedAt`
 * stamp). A milestone that the journey passes without satisfying is `missed`.
 * Milestones power the progress visualization of an experience and feed back
 * into guidance (e.g. a "next-step" hint when the current stage's milestone
 * is one event away).
 *
 * Milestone criteria are intentionally a closed algebra: `event` (a named
 * event must fire), `state` (a key/value predicate against the journey's
 * accumulated state), `duration` (the user must remain in the stage for ≥ N
 * millis), `count` (an event must fire ≥ N times), `manual` (only
 * `evaluate()` with an explicit force flag marks it achieved). This closed
 * algebra keeps evaluation deterministic and auditable.
 *
 * Determinism rule: pure types + a pure PORT contract — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

/** The canonical milestone-criteria types. */
export type MilestoneCriteriaType =
  | "event"
  | "state"
  | "duration"
  | "count"
  | "manual";

/** The lifecycle status of a single milestone. */
export type MilestoneStatus = "pending" | "achieved" | "missed";

/**
 * The criteria a milestone must satisfy to be `achieved`.
 *
 * - `type` — one of the five canonical types.
 * - `params` — opaque, criteria-type-specific parameters:
 *   - `event` → `{ event: string }` — the event name to match.
 *   - `state` → `{ key: string; value: unknown }` — equality against journey
 *     state.
 *   - `duration` → `{ minMs: number }` — minimum millis in stage.
 *   - `count` → `{ event: string; min: number }` — event must fire ≥ N times.
 *   - `manual` → `{}` — no params; only manual force achieves it.
 */
export interface MilestoneCriteria {
  readonly type: MilestoneCriteriaType;
  readonly params: Readonly<Record<string, unknown>>;
}

/**
 * A single milestone.
 *
 * - `id` — stable identifier (unique within the journey).
 * - `journeyId` — the journey the milestone belongs to.
 * - `stage` — the stage id the milestone is anchored to.
 * - `achievedAt` — epoch-millis stamp; `undefined` until achieved.
 * - `criteria` — the criteria object.
 */
export interface Milestone {
  readonly id: string;
  readonly journeyId: string;
  readonly name: string;
  readonly description: string;
  readonly stage: string;
  readonly achievedAt?: number;
  readonly status: MilestoneStatus;
  readonly criteria: MilestoneCriteria;
}

/**
 * The MilestoneTracker PORT. Implementations are event-driven and
 * deterministic: identical `(journeyId, event, now)` inputs advance identical
 * internal counters; `evaluate` is a pure function of those counters + `now`.
 *
 * - `track` — record an event against the journey. May auto-achieve one or
 *   more pending milestones whose `event` / `count` criteria are now met.
 * - `evaluate` — re-evaluate every pending milestone of the journey against
 *   the current state + `now`. Returns the updated milestone set (achieved /
 *   missed). `state`-criteria milestones consult the journey state carried in
 *   the tracker; `duration`-criteria milestones consult `now - stage.enteredAt`.
 * - `listMilestones` — read-only snapshot of all milestones for the journey.
 */
export interface MilestoneTracker {
  track(journeyId: string, event: string, now: number): void;
  evaluate(journeyId: string, now: number): readonly Milestone[];
  listMilestones(journeyId: string): readonly Milestone[];
}

/**
 * Pure helper: read a `string`-typed parameter from a criteria params map.
 * Returns `undefined` if the key is absent or the value is not a string.
 */
export function paramString(
  criteria: MilestoneCriteria,
  key: string,
): string | undefined {
  const v = criteria.params[key];
  return typeof v === "string" ? v : undefined;
}

/**
 * Pure helper: read a `number`-typed parameter from a criteria params map.
 * Returns `undefined` if the key is absent or the value is not a finite
 * number.
 */
export function paramNumber(
  criteria: MilestoneCriteria,
  key: string,
): number | undefined {
  const v = criteria.params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
