/**
 * @kernel/coordination/infrastructure/in-memory-escalation-engine — the
 * in-memory `EscalationEngine` implementation.
 *
 * Pure data structures + a per-instance counter for id minting. No
 * `Date.now()`, no `Math.random()`. All time comes from the `now` argument.
 *
 * `evaluate` walks `policies` in declaration order; the FIRST policy whose
 * `condition` holds against `context.attributes` produces an `Escalation`
 * (status `triggered`). Unknown predicate ops evaluate to `false` (fail-safe:
 * never trigger on an unknown condition). Protocols that need richer
 * predicates install their own evaluators via the extension system.
 *
 * Transition table:
 *   triggered ──acknowledge──► acknowledged
 *   (triggered | acknowledged) ──resolve──► resolved
 */

import { asId, IllegalStateError } from "@kernel/shared-kernel";
import type {
  EscalationId,
  Escalation,
  EscalationTrigger,
  Priority,
  PredicateSpec,
  ProvenanceRef,
  ResourceId,
  PrincipalId,
  UnknownRecord,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  EscalationPolicy,
  EscalationContext,
  EscalationEngine,
} from "../domain";

export class InMemoryEscalationEngine implements EscalationEngine {
  private counter = 0;

  evaluate(
    subjectType: EscalationContext["subjectType"],
    subjectId: string,
    policies: readonly EscalationPolicy[],
    context: EscalationContext,
    now: number
  ): Escalation | undefined {
    for (const policy of policies) {
      if (this.evaluatePredicate(policy.condition, context.attributes)) {
        return this.mintEscalation(
          subjectType,
          subjectId,
          policy,
          context,
          now
        );
      }
    }
    return undefined;
  }

  acknowledge(escalation: Escalation, _now: number): Escalation {
    if (escalation.status !== "triggered") {
      throw new IllegalStateError(
        `Escalation '${escalation.id}' cannot be acknowledged from status '${escalation.status}'`
      );
    }
    return { ...escalation, status: "acknowledged" };
  }

  resolve(escalation: Escalation, now: number): Escalation {
    if (escalation.status === "resolved" || escalation.status === "ignored") {
      throw new IllegalStateError(
        `Escalation '${escalation.id}' cannot be resolved from terminal status '${escalation.status}'`
      );
    }
    return { ...escalation, status: "resolved", resolvedAt: now };
  }

  // ── Internal: escalation minting ────────────────────────────────────────
  private mintEscalation(
    subjectType: EscalationContext["subjectType"],
    subjectId: string,
    policy: EscalationPolicy,
    context: EscalationContext,
    now: number
  ): Escalation {
    const id = this.mintEscalationId(subjectType, subjectId, policy.trigger, now);
    return {
      id,
      subjectType,
      subjectId,
      tenantId: context.tenantId,
      trigger: policy.trigger,
      severity: policy.severity,
      status: "triggered",
      triggeredAt: now,
      target: policy.target,
      reason: policy.reason ?? `escalation: ${policy.trigger} on ${subjectType}#${subjectId}`,
      provenance: context.provenance,
    };
  }

  private mintEscalationId(
    subjectType: string,
    subjectId: string,
    trigger: EscalationTrigger,
    now: number
  ): EscalationId {
    this.counter += 1;
    return asId<"EscalationId">(
      `esc#${subjectType}#${subjectId}#${trigger}#${now}#${this.counter}`
    );
  }

  /**
   * Built-in predicate evaluator. Recognised ops:
   *   `eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `in`, `and`, `or`, `not`,
   *   `attr-eq`, `attr-ne`, `attr-gt`, `attr-lt`.
   * The `attr-*` ops read keys off `context.attributes`. Unknown ops evaluate
   * to `false` (fail-safe — never trigger).
   */
  private evaluatePredicate(spec: PredicateSpec, attrs: UnknownRecord): boolean {
    const { op, args } = spec;
    switch (op) {
      case "eq":
        return args[0] === args[1];
      case "ne":
        return args[0] !== args[1];
      case "gt":
        return Number(args[0]) > Number(args[1]);
      case "lt":
        return Number(args[0]) < Number(args[1]);
      case "gte":
        return Number(args[0]) >= Number(args[1]);
      case "lte":
        return Number(args[0]) <= Number(args[1]);
      case "in": {
        const list = args[1];
        return Array.isArray(list) && list.includes(args[0]);
      }
      case "and":
        return args.every((s) => this.evaluatePredicate(s as PredicateSpec, attrs));
      case "or":
        return args.some((s) => this.evaluatePredicate(s as PredicateSpec, attrs));
      case "not":
        return !this.evaluatePredicate(args[0] as PredicateSpec, attrs);
      case "attr-eq":
        return attrs[String(args[0] ?? "")] === args[1];
      case "attr-ne":
        return attrs[String(args[0] ?? "")] !== args[1];
      case "attr-gt": {
        const v = attrs[String(args[0] ?? "")];
        return typeof v === "number" && v > Number(args[1] ?? 0);
      }
      case "attr-lt": {
        const v = attrs[String(args[0] ?? "")];
        return typeof v === "number" && v < Number(args[1] ?? 0);
      }
      default:
        return false;
    }
  }
}

export type {
  EscalationId,
  Escalation,
  EscalationTrigger,
  Priority,
  ProvenanceRef,
  ResourceId,
  PrincipalId,
  TenantId,
};
