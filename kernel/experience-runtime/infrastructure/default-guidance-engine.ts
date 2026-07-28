/**
 * @kernel/experience-runtime/infrastructure/default-guidance-engine —
 * rule-based, deterministic implementation of the `GuidanceEngine` PORT.
 *
 * Guidance is generated from the session + journey + context bag using a
 * fixed set of rules. The rules are deliberately simple and stable so that
 * identical inputs produce identical guidance:
 *
 *   1. No journey: emit a single `context` guidance noting the absence.
 *   2. Journey completed: emit a `next-step` guidance celebrating + suggesting
 *      a new journey.
 *   3. Journey abandoned / paused: emit a `warning` / `context` guidance.
 *   4. Journey active:
 *      - Always emit a `hint` naming the current stage.
 *      - If the session is idle (per `effectiveSessionStatus`), emit a
 *        `next-step` nudging the user back.
 *      - If the session has accessibility needs, emit a `tip` per need
 *        (capped at 2).
 *      - If the session device is `voice`, emit a `context` noting voice mode.
 *      - For each enabled feature flag (capped at 3), emit a `tip`.
 *      - If journey progress < 25%, emit a `context` "just getting started".
 *      - If a next pending stage exists, emit a `next-step` naming it.
 *      - If the context bag carries a `focus` string, emit a `context`.
 *
 * Guidance is cached per session; `listActive` returns the cumulative set
 * (filtered to non-dismissed, sorted by descending priority then ascending
 * `triggeredAt`). `dismiss` marks an item as dismissed (no-op if not
 * dismissible or not found).
 *
 * Determinism: NO `Date.now()`, NO `Math.random()`. All time flows through
 * the `now` argument. Guidance ids are `${sessionId}#${counter}` where the
 * counter is a per-session monotonic integer — identical sequences of
 * `generate` calls produce identical ids.
 */

import type {
  ExperienceGuidance,
  ExperienceJourney,
  ExperienceSession,
  GuidanceEngine,
  GuidanceKind,
} from "../domain";
import {
  DEFAULT_SESSION_IDLE_MS,
  activeStage,
  completedStageCount,
  effectiveSessionStatus,
  nextPendingStage,
} from "../domain";

/** Per-kind priority used by the default engine. Higher = more important. */
export const GUIDANCE_KIND_PRIORITY: Readonly<Record<GuidanceKind, number>> = {
  warning: 100,
  "next-step": 80,
  instruction: 70,
  recommendation: 60,
  hint: 50,
  tip: 40,
  context: 30,
};

/** Default cap on the number of accessibility-derived tips per batch. */
export const DEFAULT_ACCESSIBILITY_TIP_CAP = 2;
/** Default cap on the number of feature-flag-derived tips per batch. */
export const DEFAULT_FEATURE_FLAG_TIP_CAP = 3;

/**
 * The default rule-based guidance engine. Construct one per
 * experience-runtime session. Internal state: per-session guidance cache +
 * per-session monotonic id counter.
 */
export class DefaultGuidanceEngine implements GuidanceEngine {
  private readonly cache = new Map<string, ExperienceGuidance[]>();
  private readonly counters = new Map<string, number>();

  generate(
    session: ExperienceSession,
    journey: ExperienceJourney | undefined,
    context: Readonly<Record<string, unknown>>,
    now: number,
  ): readonly ExperienceGuidance[] {
    const batch = this.ruleGenerate(session, journey, context, now);
    const cached = this.cache.get(session.id) ?? [];
    const merged = [...cached, ...batch];
    this.cache.set(session.id, merged);
    return batch;
  }

  dismiss(guidanceId: string): void {
    for (const [, list] of this.cache) {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.id === guidanceId && item.dismissible) {
          list[i] = { ...item, dismissed: true };
          return;
        }
      }
    }
  }

  listActive(sessionId: string): readonly ExperienceGuidance[] {
    const list = this.cache.get(sessionId) ?? [];
    return list
      .filter((g) => !g.dismissed)
      .slice()
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.triggeredAt - b.triggeredAt;
      });
  }

  // ── Internal helpers ───────────────────────────────────────────────────

  private nextId(sessionId: string): string {
    const n = (this.counters.get(sessionId) ?? 0) + 1;
    this.counters.set(sessionId, n);
    return `${sessionId}#${n}`;
  }

  private mint(
    sessionId: string,
    kind: GuidanceKind,
    content: string,
    now: number,
    dismissible = true,
  ): ExperienceGuidance {
    return {
      id: this.nextId(sessionId),
      sessionId,
      kind,
      content,
      priority: GUIDANCE_KIND_PRIORITY[kind],
      dismissible,
      dismissed: false,
      triggeredAt: now,
    };
  }

  private ruleGenerate(
    session: ExperienceSession,
    journey: ExperienceJourney | undefined,
    context: Readonly<Record<string, unknown>>,
    now: number,
  ): ExperienceGuidance[] {
    const out: ExperienceGuidance[] = [];
    const sid = session.id;

    // Rule 1: no journey bound to the session.
    if (!journey) {
      out.push(
        this.mint(
          sid,
          "context",
          "No active journey — explore the application to begin.",
          now,
        ),
      );
      // Still surface device / accessibility / focus context even without a journey.
      this.appendContextualRules(out, session, context, now);
      return out;
    }

    // Rule 2/3: journey is in a non-active status.
    if (journey.status === "completed") {
      out.push(
        this.mint(
          sid,
          "next-step",
          "Journey complete — start a new one to keep going.",
          now,
        ),
      );
      return out;
    }
    if (journey.status === "abandoned") {
      out.push(
        this.mint(
          sid,
          "warning",
          "This journey was abandoned — resume it to pick up where you left off.",
          now,
        ),
      );
      return out;
    }
    if (journey.status === "paused") {
      out.push(
        this.mint(
          sid,
          "context",
          "Journey paused — resume when you're ready.",
          now,
        ),
      );
      return out;
    }

    // Rule 4: journey active.
    const active = activeStage(journey);
    if (active) {
      out.push(
        this.mint(
          sid,
          "hint",
          `You're in the ${active.name} stage.`,
          now,
        ),
      );
    }

    // Idle nudge.
    const eff = effectiveSessionStatus(session, now);
    if (eff === "idle" && active) {
      out.push(
        this.mint(
          sid,
          "next-step",
          `Pick up where you left off in ${active.name}.`,
          now,
        ),
      );
    }

    // Progress context (< 25% complete).
    const total = journey.stages.length;
    const completed = completedStageCount(journey);
    if (total > 0 && completed / total < 0.25) {
      out.push(
        this.mint(
          sid,
          "context",
          "Just getting started — take it one stage at a time.",
          now,
        ),
      );
    }

    // Next-stage preview.
    const next = nextPendingStage(journey);
    if (next) {
      out.push(
        this.mint(
          sid,
          "next-step",
          `Up next: ${next.name}.`,
          now,
        ),
      );
    }

    // Contextual rules (accessibility, device, feature flags, focus).
    this.appendContextualRules(out, session, context, now);

    return out;
  }

  private appendContextualRules(
    out: ExperienceGuidance[],
    session: ExperienceSession,
    context: Readonly<Record<string, unknown>>,
    now: number,
  ): void {
    const sid = session.id;

    // Accessibility needs → tip per need (capped).
    const a11y = session.context.accessibility;
    if (a11y && a11y.length > 0) {
      const capped = a11y.slice(0, DEFAULT_ACCESSIBILITY_TIP_CAP);
      for (const need of capped) {
        out.push(
          this.mint(
            sid,
            "tip",
            `Accessibility hint: ${need} support is on.`,
            now,
          ),
        );
      }
    }

    // Voice device → context note.
    if (session.context.device === "voice") {
      out.push(
        this.mint(
          sid,
          "context",
          "Voice mode active — use spoken commands.",
          now,
        ),
      );
    }

    // Feature flags → tip per enabled flag (capped).
    const flags = session.context.featureFlags ?? {};
    const enabled = Object.keys(flags).filter((k) => flags[k] === true);
    if (enabled.length > 0) {
      const capped = enabled.slice(0, DEFAULT_FEATURE_FLAG_TIP_CAP);
      for (const name of capped) {
        out.push(
          this.mint(
            sid,
            "tip",
            `Feature enabled: ${name}.`,
            now,
          ),
        );
      }
    }

    // Context-bag focus → context note.
    const focus = context["focus"];
    if (typeof focus === "string" && focus.length > 0) {
      out.push(
        this.mint(
          sid,
          "context",
          `Focus: ${focus}.`,
          now,
        ),
      );
    }
  }
}

// Re-export for callers that want to import the constant alongside the class.
export { DEFAULT_SESSION_IDLE_MS };
