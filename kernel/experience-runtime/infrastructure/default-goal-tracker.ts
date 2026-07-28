/**
 * @kernel/experience-runtime/infrastructure/default-goal-tracker —
 * deterministic implementation of the `GoalTracker` PORT.
 *
 * Internal state: a single `Map<goalId, ExperienceGoal>`. `set` is an
 * idempotent upsert. `progress(goalId, delta)` adds `delta` to the goal's
 * `current` (clamped at ≥ 0) and returns the updated goal — it does NOT
 * evaluate status; the caller must call `evaluate` for that. `evaluate`
 * flips the goal's status based on `current` vs `target` and `deadline` vs
 * `now`:
 *
 *   - `current >= target` → `achieved` (regardless of deadline).
 *   - `deadline !== undefined && now >= deadline && current < target` →
 *     `missed`.
 *   - Otherwise the status is unchanged (typically `active`, but `abandoned`
 *     goals are NOT auto-revived by `evaluate`).
 *
 * `abandoned` goals are sticky — `evaluate` does not flip them back to
 * `active`. The caller can call `set` with a fresh `active` goal to revive.
 *
 * Determinism: NO `Date.now()`, NO `Math.random()`. Identical sequences of
 * `set` / `progress` / `evaluate` / `abandon` calls produce identical state.
 */

import type {
  ExperienceGoal,
  ExperienceGoalStatus,
  GoalTracker,
} from "../domain";

export class DefaultGoalTracker implements GoalTracker {
  private readonly goals = new Map<string, ExperienceGoal>();

  // ── Port methods ───────────────────────────────────────────────────────

  set(goal: ExperienceGoal): void {
    this.goals.set(goal.id, goal);
  }

  progress(goalId: string, delta: number): ExperienceGoal | undefined {
    const existing = this.goals.get(goalId);
    if (!existing) return undefined;
    const nextCurrent = Math.max(0, existing.current + delta);
    const updated: ExperienceGoal = {
      ...existing,
      current: nextCurrent,
    };
    this.goals.set(goalId, updated);
    return updated;
  }

  evaluate(goalId: string, now: number): ExperienceGoal | undefined {
    const existing = this.goals.get(goalId);
    if (!existing) return undefined;

    // Abandoned goals are sticky — `evaluate` does not revive them.
    if (existing.status === "abandoned") return existing;

    const nextStatus: ExperienceGoalStatus = computeStatus(existing, now);
    if (nextStatus === existing.status) return existing;
    const updated: ExperienceGoal = { ...existing, status: nextStatus };
    this.goals.set(goalId, updated);
    return updated;
  }

  listGoals(userId: string): readonly ExperienceGoal[] {
    return Array.from(this.goals.values()).filter((g) => g.userId === userId);
  }

  // ── Optional concrete methods ──────────────────────────────────────────

  /**
   * Mark a goal as `abandoned`. The status is sticky — `evaluate` will not
   * revive an abandoned goal. Returns the updated goal or `undefined` if the
   * id was not found.
   */
  abandon(goalId: string): ExperienceGoal | undefined {
    const existing = this.goals.get(goalId);
    if (!existing) return undefined;
    if (existing.status === "abandoned") return existing;
    const updated: ExperienceGoal = { ...existing, status: "abandoned" };
    this.goals.set(goalId, updated);
    return updated;
  }

  /** Read a goal by id without mutating anything. */
  get(goalId: string): ExperienceGoal | undefined {
    return this.goals.get(goalId);
  }

  /** Read all goals (across all users). */
  listAll(): readonly ExperienceGoal[] {
    return Array.from(this.goals.values());
  }
}

/**
 * Pure helper: compute the next status for a goal given the evaluation
 * timestamp. Deterministic — pure function of `(goal, now)`.
 *
 *   - `current >= target` → `achieved`.
 *   - `deadline !== undefined && now >= deadline && current < target` →
 *     `missed`.
 *   - Otherwise → the goal's current status (unchanged).
 */
export function computeStatus(
  goal: ExperienceGoal,
  now: number,
): ExperienceGoalStatus {
  if (goal.current >= goal.target) return "achieved";
  if (
    goal.deadline !== undefined &&
    Number.isFinite(goal.deadline) &&
    now >= goal.deadline &&
    goal.current < goal.target
  ) {
    return "missed";
  }
  return goal.status;
}
