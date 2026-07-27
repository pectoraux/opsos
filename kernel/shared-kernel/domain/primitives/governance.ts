/**
 * @kernel/shared-kernel/domain/primitives/governance — the decision-shaping
 * canonical primitives.
 *
 *   Policy · Rule · Decision
 *
 * `Rule.condition` is a serialisable `PredicateSpec` (see value-objects), never
 * a JS function. This keeps governance replayable, transportable and auditable.
 */

import type {
  PolicyId,
  RuleId,
  DecisionId,
} from "../identifiers";
import type {
  PredicateSpec,
  DecisionInput,
  DecisionSubject,
  ProvenanceRef,
} from "../value-objects";

// ── 8. Policy ───────────────────────────────────────────────────────────────

export type PolicyScope = "tenant" | "organization" | "workflow" | "resource" | "global";
export type PolicyEffect = "allow" | "deny" | "require-approval";
export type PolicyStatus = "draft" | "active" | "archived";

export interface Policy {
  readonly id: PolicyId;
  readonly version: number;
  readonly name: string;
  readonly scope: PolicyScope;
  readonly rules: readonly RuleId[];
  readonly priority: number;
  readonly effect: PolicyEffect;
  readonly status: PolicyStatus;
}

// ── 9. Rule ─────────────────────────────────────────────────────────────────

export type RuleEffect = "allow" | "deny" | "require-approval" | "transform";

export interface Rule {
  readonly id: RuleId;
  readonly name: string;
  readonly condition: PredicateSpec;
  readonly effect: RuleEffect;
  readonly priority: number;
  readonly scope: PolicyScope;
}

// ── 15. Decision ────────────────────────────────────────────────────────────

export type DecisionOutcome =
  | "allow"
  | "deny"
  | "deferred"
  | "require-approval"
  | "transformed";

export interface Decision {
  readonly id: DecisionId;
  readonly decisionType: string;
  readonly subject: DecisionSubject;
  readonly inputs: readonly DecisionInput[];
  readonly outcome: DecisionOutcome;
  readonly rationale: string;
  readonly matchedRules: readonly RuleId[];
  readonly evaluatedAt: number;
  readonly provenance: ProvenanceRef;
}
