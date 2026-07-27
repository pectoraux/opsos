/**
 * @kernel/policy/domain/decision — the decision primitives the policy engine
 * produces, plus the evaluation context the engine consumes.
 *
 * Re-exports the canonical `Decision`, `DecisionOutcome`, `DecisionId` from
 * `@kernel/shared-kernel` so consumers can import them via `@kernel/policy`.
 *
 * Determinism contract:
 *   - `Decision.evaluatedAt` is sourced from the `now` argument the caller
 *     passes into the engine (which the caller sources from
 *     `ExecutionContext.clock.now()`). The domain/application layers never
 *     call `Date.now()`.
 *   - `Decision.id` is derived deterministically from the evaluation inputs
 *     (correlationId + now + inputHash + matched rule ids), so two identical
 *     evaluations produce identical DecisionIds — replay is byte-identical.
 *   - `Decision.provenance.inputHash` is a stable hash of `ctx.inputs` (sorted
 *     keys) so the same inputs always hash the same way.
 */

import type {
  DecisionId,
  DecisionOutcome,
  PrincipalId,
  TenantId,
} from "@kernel/shared-kernel";
import type { Decision } from "@kernel/shared-kernel";
import type { Rule } from "./policy-definition";

// Re-export the canonical governance decision primitives.
export type { Decision, DecisionOutcome } from "@kernel/shared-kernel";
export type { DecisionId } from "@kernel/shared-kernel";

/**
 * The context the policy engine evaluates against. Carries:
 *   - `subject` — the thing being decided about (a task, resource, intent,
 *     etc.). It is a plain `Record<string, unknown>` so any domain entity
 *     (from any future protocol) can be the subject without coupling the
 *     policy module to that protocol's types.
 *   - `action` — the verb being authorised/decided (`"execute"`, `"approve"`,
 *     `"delete"`, …). Generic operational verbs only.
 *   - `resource` — optional resource descriptor (`"task:42"`, `"doc:17"`).
 *   - `principalId` / `tenantId` — opaque branded IDs sourced from
 *     `ExecutionContext`. The policy module does NOT import the identity or
 *     organizations modules; it treats these as opaque strings.
 *   - `correlationId` — threads this logical operation end-to-end.
 *   - `inputs` — extra decision inputs (free-form key/value). Hashed into
 *     decision provenance so two evaluations with different inputs produce
 *     different provenance hashes.
 *   - `sourceEventIds` — events that caused this evaluation; recorded into
 *     `Decision.provenance.sourceEventIds` for audit/replay.
 *
 * The context is pure data. The engine does NOT mutate it.
 */
export interface PolicyEvaluationContext {
  /** The thing being decided about (a task, resource, intent, etc.). */
  readonly subject: Readonly<Record<string, unknown>>;
  /** The action being authorised/decided (e.g. `"execute"`, `"approve"`). */
  readonly action: string;
  /** Optional resource descriptor (e.g. `"task:42"`). */
  readonly resource?: string;
  /** Opaque security principal — sourced from `ExecutionContext.principalId`. */
  readonly principalId: PrincipalId | null;
  /** Opaque tenancy boundary — sourced from `ExecutionContext.tenantId`. */
  readonly tenantId: TenantId | null;
  /** Correlation id threading this logical operation end-to-end. */
  readonly correlationId: string;
  /** Extra decision inputs (free-form). Hashed into decision provenance. */
  readonly inputs: Readonly<Record<string, unknown>>;
  /** Events that caused this evaluation; recorded into `Decision.provenance`. */
  readonly sourceEventIds: readonly string[];
}

/**
 * The result of evaluating a single `PolicyDefinition` against a context.
 *
 * `decision` is the canonical `Decision` (matched rule ids, outcome,
 * rationale, provenance, evaluatedAt = `now`). `matchedRules` is the list of
 * full `Rule` objects that matched (one per policy that produced a match) —
 * richer than `Decision.matchedRules` (which is `RuleId[]`) for callers that
 * need to inspect the matched conditions.
 */
export interface EvaluationResult {
  /** The canonical decision (carries ids, outcome, rationale, provenance). */
  readonly decision: Decision;
  /** Full `Rule` objects that matched (one per matching policy). */
  readonly matchedRules: readonly Rule[];
}
