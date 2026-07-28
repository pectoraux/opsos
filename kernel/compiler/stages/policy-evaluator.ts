/**
 * @kernel/compiler/stages/policy-evaluator — phase `evaluate`.
 *
 * Evaluates the registered policies against the intent (as the decision
 * subject) and gates compilation:
 *   - `deny`         → abort (returns `AbortCompilationError` carrying the decision).
 *   - `require-approval` → abort (compilation cannot proceed without approval).
 *   - `allow` / `deferred` / `transformed` → proceed, recording the decision.
 *
 * The subject passed to the policy engine is the intent itself (kind="intent",
 * id=intent.id, plus the intent's priority/type/payload as evaluatable fields).
 * `now` is sourced from `ctx.clock.now()`.
 */

import type { Result, KernelError } from "@kernel/shared-kernel";
import { ok } from "@kernel/shared-kernel";
import type { PolicyEngine, PolicyEvaluationContext } from "@kernel/policy";
import { AbortCompilationError } from "../domain/compiler-error";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

export interface PolicyEvaluatorStageDeps {
  readonly engine: PolicyEngine;
}

export class PolicyEvaluatorStage implements CompilerStage {
  readonly name = "kernel.policy-evaluator";
  readonly phase = "evaluate" as const;
  readonly order = 10;
  private readonly engine: PolicyEngine;

  constructor(deps: PolicyEvaluatorStageDeps) {
    this.engine = deps.engine;
  }

  async run(ctx: CompilationContext): Promise<Result<CompilationContext, KernelError>> {
    const intent = ctx.state.normalizedIntent ?? ctx.intent;
    const now = ctx.clock.now();

    const evalCtx: PolicyEvaluationContext = {
      subject: {
        kind: "intent",
        id: String(intent.id),
        type: intent.type,
        priority: intent.priority,
        constraints: intent.constraints,
      },
      action: "compile",
      resource: `intent:${intent.id}`,
      principalId: ctx.principalId,
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      inputs: { intentType: intent.type, priorityLevel: intent.priority.level },
      sourceEventIds: [],
    };

    const decision = await this.engine.evaluate(evalCtx, now);
    const diags = [...ctx.state.diagnostics];

    if (decision.outcome === "deny") {
      diags.push(
        diagnostic(this.name, "error", "POLICY_DENIED", decision.rationale, now)
      );
      return {
        ok: false,
        error: new AbortCompilationError(`Policy denied compilation of intent '${intent.id}'`, decision),
      };
    }

    if (decision.outcome === "require-approval") {
      diags.push(
        diagnostic(this.name, "warn", "POLICY_REQUIRES_APPROVAL", decision.rationale, now)
      );
      return {
        ok: false,
        error: new AbortCompilationError(`Policy requires approval for intent '${intent.id}'`, decision),
      };
    }

    diags.push(
      diagnostic(this.name, "info", `POLICY_${decision.outcome.toUpperCase()}`, decision.rationale, now)
    );

    return ok(ctx.with({ policyDecision: decision, diagnostics: diags }));
  }
}
