/**
 * @kernel/coordination/domain/escalation-engine — the EscalationEngine PORT.
 *
 * An Escalation is an automatic notification triggered when a policy condition
 * holds against a subject (an assignment / offer / reservation / commitment /
 * queue). The engine evaluates a list of `EscalationPolicy` entries against a
 * context and returns the FIRST triggered escalation (or `undefined`).
 *
 * Lifecycle:
 *   triggered ──acknowledge──► acknowledged
 *   acknowledged ──resolve──► resolved
 *   (any non-resolved) ──ignore──► ignored  (terminal, no further transitions)
 *
 * Determinism rule: `now` is supplied by the caller. Policies are evaluated in
 * declaration order; the first whose `condition` holds wins. No `Date.now()`,
 * no `Math.random()`.
 */

import type {
  ResourceId,
  PrincipalId,
  EscalationId,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  Escalation,
  EscalationTrigger,
  Priority,
  PredicateSpec,
  ProvenanceRef,
  UnknownRecord,
} from "@kernel/shared-kernel";

/**
 * A single declarative escalation policy. Pure data: a `trigger` category, a
 * serialisable `condition` (PredicateSpec), a `target` (who to notify), and a
 * `severity`. Evaluated in order; first match wins.
 */
export interface EscalationPolicy {
  readonly trigger: EscalationTrigger;
  readonly condition: PredicateSpec;
  readonly target: ResourceId | PrincipalId;
  readonly severity: Priority;
  /** Optional human-readable reason template; the engine fills `{trigger}`. */
  readonly reason?: string;
}

/**
 * The context against which escalation policies are evaluated. Carries the
 * subject identifier, the tenant, and an opaque `attributes` bag (typically
 * the subject's serialisable state — e.g. an Assignment's status + age).
 */
export interface EscalationContext {
  readonly tenantId: TenantId;
  readonly subjectType: "assignment" | "offer" | "reservation" | "commitment" | "queue";
  readonly subjectId: string;
  readonly attributes: UnknownRecord;
  readonly provenance: ProvenanceRef;
}

/**
 * The EscalationEngine PORT. Every method is PURE.
 */
export interface EscalationEngine {
  /**
   * Evaluate `policies` against `context` at time `now`. Returns the FIRST
   * triggered `Escalation` (status `triggered`), or `undefined` if no policy
   * matched.
   *
   * The engine mints a deterministic `EscalationId` (from `subjectType`,
   * `subjectId`, `trigger`, `now`, and an internal counter).
   */
  evaluate(
    subjectType: EscalationContext["subjectType"],
    subjectId: string,
    policies: readonly EscalationPolicy[],
    context: EscalationContext,
    now: number
  ): Escalation | undefined;

  /** Acknowledge a triggered escalation. */
  acknowledge(escalation: Escalation, now: number): Escalation;

  /** Resolve an acknowledged (or triggered) escalation. */
  resolve(escalation: Escalation, now: number): Escalation;
}

export type { EscalationId, Escalation, EscalationTrigger };
