/**
 * @kernel/experience-runtime/infrastructure/default-milestone-tracker —
 * event-driven, deterministic implementation of the `MilestoneTracker` PORT.
 *
 * Internal state per journey:
 *   - `milestones: Map<milestoneId, Milestone>` — the current milestone set.
 *   - `eventLog: { event: string; at: number }[]` — append-only log of
 *     application-emitted events (used by `event` / `count` criteria).
 *   - `stageEnterTimes: Map<stageId, number>` — the `now` recorded when
 *     `track(journeyId, "stage-enter:<stageId>", now)` was called (used by
 *     `duration` criteria).
 *   - `exitedStages: Set<stageId>` — stages whose `stage-exit:<stageId>`
 *     event has been tracked (pending milestones of these stages that are
 *     not yet satisfied are marked `missed` during `evaluate`).
 *   - `stateMap: Map<key, unknown>` — key/value state updated via the
 *     optional `setState` method (used by `state` criteria).
 *
 * Event-name conventions used by the in-memory implementation:
 *   - `stage-enter:<stageId>` — records the enter time of the stage.
 *   - `stage-exit:<stageId>` — marks the stage as exited (pending milestones
 *     of this stage are eligible for `missed` during `evaluate`).
 *   - `state:<key>=<value>` — updates the state map. `<value>` is parsed as
 *     boolean / number / string (in that order; falls back to the raw
 *     string).
 *   - Any other string — appended to the event log verbatim (used by `event`
 *     and `count` criteria).
 *
 * `evaluate(journeyId, now)` walks every pending milestone of the journey
 * and:
 *   - If its criteria are met → mark `achieved` (stamp `achievedAt = now`).
 *   - Else if its stage is in `exitedStages` → mark `missed`.
 *   - Else leave it `pending`.
 *
 * `manual`-criteria milestones are NEVER auto-achieved by `evaluate`; the
 * caller must use the optional `markAchieved(milestoneId, now)` method.
 *
 * Determinism: NO `Date.now()`, NO `Math.random()`. Identical sequences of
 * `track` / `evaluate` / `seed` / `setState` / `markAchieved` calls produce
 * identical state.
 */

import type {
  Milestone,
  MilestoneCriteria,
  MilestoneTracker,
} from "../domain";
import { paramString, paramNumber } from "../domain";

interface JourneyEvent {
  readonly event: string;
  readonly at: number;
}

interface JourneyState {
  readonly milestones: Map<string, Milestone>;
  readonly eventLog: JourneyEvent[];
  readonly stageEnterTimes: Map<string, number>;
  readonly exitedStages: Set<string>;
  readonly stateMap: Map<string, unknown>;
}

export class DefaultMilestoneTracker implements MilestoneTracker {
  private readonly byJourney = new Map<string, JourneyState>();

  // ── Port methods ───────────────────────────────────────────────────────

  track(journeyId: string, event: string, now: number): void {
    const st = this.stateFor(journeyId);
    if (event.startsWith("stage-enter:")) {
      const stageId = event.slice("stage-enter:".length);
      st.stageEnterTimes.set(stageId, now);
      return;
    }
    if (event.startsWith("stage-exit:")) {
      const stageId = event.slice("stage-exit:".length);
      st.exitedStages.add(stageId);
      return;
    }
    if (event.startsWith("state:")) {
      const rest = event.slice("state:".length);
      const eq = rest.indexOf("=");
      if (eq >= 0) {
        const key = rest.slice(0, eq);
        const raw = rest.slice(eq + 1);
        st.stateMap.set(key, parseStateValue(raw));
      }
      return;
    }
    st.eventLog.push({ event, at: now });
  }

  evaluate(journeyId: string, now: number): readonly Milestone[] {
    const st = this.stateFor(journeyId);
    for (const [id, m] of st.milestones) {
      if (m.status !== "pending") continue;
      if (isCriteriaMet(m.criteria, m.stage, st, now)) {
        const achieved: Milestone = {
          ...m,
          status: "achieved",
          achievedAt: now,
        };
        st.milestones.set(id, achieved);
        continue;
      }
      if (st.exitedStages.has(m.stage)) {
        const missed: Milestone = { ...m, status: "missed" };
        st.milestones.set(id, missed);
      }
    }
    return Array.from(st.milestones.values());
  }

  listMilestones(journeyId: string): readonly Milestone[] {
    const st = this.byJourney.get(journeyId);
    return st ? Array.from(st.milestones.values()) : [];
  }

  // ── Optional concrete methods (used by the start-journey use-case + by
  //    application code that needs to drive `state` / `manual` criteria). ─

  /**
   * Seed a milestone into the tracker's internal map. Used by the
   * `startJourney` use-case to register the freshly-created milestones.
   * Idempotent upsert by `milestone.id`.
   */
  seed(milestone: Milestone): void {
    const st = this.stateFor(milestone.journeyId);
    st.milestones.set(milestone.id, milestone);
  }

  /**
   * Update a key in the journey's state map. Used to drive `state`-criteria
   * milestones without encoding the value in an event string.
   */
  setState(journeyId: string, key: string, value: unknown): void {
    const st = this.stateFor(journeyId);
    st.stateMap.set(key, value);
  }

  /**
   * Force-achieve a `manual`-criteria milestone. No-op for non-manual
   * milestones or missing ids. Stamps `achievedAt = now`.
   */
  markAchieved(milestoneId: string, now: number): Milestone | undefined {
    for (const [, st] of this.byJourney) {
      const m = st.milestones.get(milestoneId);
      if (m && m.criteria.type === "manual") {
        const achieved: Milestone = {
          ...m,
          status: "achieved",
          achievedAt: now,
        };
        st.milestones.set(milestoneId, achieved);
        return achieved;
      }
    }
    return undefined;
  }

  // ── Internal helpers ───────────────────────────────────────────────────

  private stateFor(journeyId: string): JourneyState {
    let st = this.byJourney.get(journeyId);
    if (!st) {
      st = {
        milestones: new Map(),
        eventLog: [],
        stageEnterTimes: new Map(),
        exitedStages: new Set(),
        stateMap: new Map(),
      };
      this.byJourney.set(journeyId, st);
    }
    return st;
  }
}

/**
 * Pure helper: is a milestone's criteria met given the current journey state?
 * `stageId` is the milestone's stage (used by `duration` criteria to look up
 * the recorded enter time). `now` is the evaluation timestamp (used by
 * `duration` criteria as the right side of the comparison).
 * Deterministic — pure function of `(criteria, stageId, state, now)`.
 */
function isCriteriaMet(
  criteria: MilestoneCriteria,
  stageId: string,
  st: JourneyState,
  now: number,
): boolean {
  switch (criteria.type) {
    case "event": {
      const name = paramString(criteria, "event");
      if (!name) return false;
      return st.eventLog.some((e) => e.event === name);
    }
    case "count": {
      const name = paramString(criteria, "event");
      const min = paramNumber(criteria, "min");
      if (!name || min === undefined) return false;
      const count = st.eventLog.filter((e) => e.event === name).length;
      return count >= min;
    }
    case "duration": {
      const minMs = paramNumber(criteria, "minMs");
      if (minMs === undefined) return false;
      const enterTime = st.stageEnterTimes.get(stageId);
      if (enterTime === undefined) return false;
      return now - enterTime >= minMs;
    }
    case "state": {
      const key = paramString(criteria, "key");
      if (!key) return false;
      const expected = criteria.params["value"];
      const actual = st.stateMap.get(key);
      return actual === expected;
    }
    case "manual":
    default:
      return false;
  }
}

/**
 * Pure helper: parse a state-event value string into a boolean / number /
 * string. Deterministic — pure function of the input.
 */
function parseStateValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const n = Number(raw);
  if (raw.length > 0 && Number.isFinite(n)) return n;
  return raw;
}
