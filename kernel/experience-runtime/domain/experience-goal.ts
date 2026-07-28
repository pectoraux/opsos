/**
 * @kernel/experience-runtime/domain/experience-goal — the ExperienceGoal value
 * object + the GoalTracker PORT.
 *
 * A goal is a long-running, cross-journey target for a user inside an
 * application: "complete 5 onboarding journeys this week", "keep average
 * satisfaction ≥ 4.5", "cut average resolution time by 20%". Goals are
 * typed (efficiency / quality / satisfaction / completion / learning /
 * engagement) so the platform can aggregate progress across goals of the
 * same type. Progress is monotonic by default — `progress` adds a delta to
 * `current` — and `evaluate` flips a goal to `achieved` (current ≥ target)
 * or `missed` (deadline elapsed without reaching target).
 *
 * Determinism rule: pure types + a pure PORT contract — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

/** The canonical goal types. */
export type ExperienceGoalType =
  | "efficiency"
  | "quality"
  | "satisfaction"
  | "completion"
  | "learning"
  | "engagement";

/** The lifecycle status of a single goal. */
export type ExperienceGoalStatus =
  | "active"
  | "achieved"
  | "missed"
  | "abandoned";

/**
 * A single user goal within an application.
 *
 * - `target` / `current` — numeric progress; `current` accumulates via
 *   `progress` deltas.
 * - `unit` — the unit of `target` / `current` (e.g. "journeys", "ms",
 *   "rating"). Aggregations across goals of the same type may sum targets /
 *   currents only when units match.
 * - `deadline` — optional epoch-millis; when elapsed with `current < target`
 *   the goal flips to `missed`.
 * - `createdAt` — epoch-millis from the RuntimeClock / `now` argument.
 */
export interface ExperienceGoal {
  readonly id: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly type: ExperienceGoalType;
  readonly description: string;
  readonly target: number;
  readonly current: number;
  readonly unit: string;
  readonly deadline?: number;
  readonly status: ExperienceGoalStatus;
  readonly createdAt: number;
}

/**
 * The GoalTracker PORT. Implementations are deterministic: identical inputs
 * produce identical progress + evaluation outputs.
 *
 * - `set` — register a goal (idempotent upsert by `id`).
 * - `progress` — add `delta` to the goal's `current` (clamped at ≥ 0). Returns
 *   the updated goal or `undefined` if the goal does not exist. Does NOT
 *   evaluate status — call `evaluate` for that.
 * - `evaluate` — flip the goal's status based on `current` vs `target` and
 *   `deadline` vs `now`. Returns the updated goal or `undefined` if missing.
 * - `listGoals` — read-only snapshot of all goals for the user.
 */
export interface GoalTracker {
  set(goal: ExperienceGoal): void;
  progress(goalId: string, delta: number): ExperienceGoal | undefined;
  evaluate(goalId: string, now: number): ExperienceGoal | undefined;
  listGoals(userId: string): readonly ExperienceGoal[];
}

/**
 * Pure helper: compute the progress ratio `current / target`, clamped to
 * `[0, 1]`. Returns `0` when `target ≤ 0` (avoids division by zero).
 */
export function goalProgressRatio(goal: ExperienceGoal): number {
  if (goal.target <= 0) return 0;
  const r = goal.current / goal.target;
  if (!Number.isFinite(r)) return 0;
  if (r < 0) return 0;
  if (r > 1) return 1;
  return r;
}
