/**
 * @kernel/experience-runtime/application/set-goal — use-case: set + track a
 * user goal.
 *
 * Wraps the `GoalTracker` port. Provides two operations:
 *   1. `set` — register a new goal (or overwrite an existing one by id).
 *   2. `progress` — add a delta to a goal's `current` and immediately
 *      evaluate its status against its target + deadline.
 *
 * Determinism rule: identical inputs + identical ports → identical outputs.
 * The caller supplies `now` for evaluation.
 */

import type {
  ExperienceGoal,
  ExperienceRegistry,
  GoalTracker,
} from "../domain";

/** The input to `SetGoal.execute`. Pure data. */
export interface SetGoalInput {
  /** The goal to register. Caller supplies a deterministic id. */
  readonly goal: ExperienceGoal;
  /** Clock-sourced epoch-millis — used for immediate evaluation. */
  readonly now: number;
  /**
   * If `true`, the use-case evaluates the goal immediately after registering
   * it (useful when restoring a goal from persistence whose deadline may
   * already have elapsed). Defaults to `true`.
   */
  readonly evaluate?: boolean;
}

/** The result of `SetGoal.execute`. */
export interface SetGoalResult {
  /** The goal as registered (status may have changed if evaluated). */
  readonly goal: ExperienceGoal;
}

/**
 * The input to the optional `progress` operation. The use-case exposes this
 * as a separate method on the same class so callers can use a single
 * instance for both setting and progressing goals.
 */
export interface ProgressGoalInput {
  readonly goalId: string;
  /** Delta to add to the goal's `current` (may be negative). */
  readonly delta: number;
  /** Clock-sourced epoch-millis — used for evaluation after the delta. */
  readonly now: number;
}

/** The result of the optional `progress` operation. */
export interface ProgressGoalResult {
  /** The updated goal, or `undefined` if the goal id was not found. */
  readonly goal: ExperienceGoal | undefined;
}

/** The use-case PORT. */
export interface SetGoal {
  execute(input: SetGoalInput): SetGoalResult;
  progress(input: ProgressGoalInput): ProgressGoalResult;
}

/**
 * Default implementation. Wraps `GoalTracker` and (optionally) the registry
 * to keep a session's `lastActivityAt` fresh when a goal progresses.
 */
export class SetGoalUseCase implements SetGoal {
  constructor(
    private readonly goals: GoalTracker,
    private readonly registry?: ExperienceRegistry,
  ) {}

  execute(input: SetGoalInput): SetGoalResult {
    this.goals.set(input.goal);
    if (input.evaluate === false) {
      return { goal: input.goal };
    }
    const evaluated = this.goals.evaluate(input.goal.id, input.now);
    return { goal: evaluated ?? input.goal };
  }

  progress(input: ProgressGoalInput): ProgressGoalResult {
    const progressed = this.goals.progress(input.goalId, input.delta);
    if (!progressed) {
      return { goal: undefined };
    }
    const evaluated = this.goals.evaluate(input.goalId, input.now);
    return { goal: evaluated ?? progressed };
  }
}
