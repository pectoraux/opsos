/**
 * @kernel/intelligence/application/explain-decision — use-case that produces an
 * Explanation for a given decision / subject.
 *
 * Thin orchestrator: delegates to the injected `ExplanationEngine`. Provided as
 * a callable use-case so application code can compose explanations into
 * higher-level workflows (audit trails, control-plane "why?" panels, conformance
 * failure reports).
 *
 * Intelligence NEVER performs work and NEVER modifies state — this use-case only
 * READS the engine. Deterministic given identical engine + input.
 */
import type {
  Explanation,
  ExplanationEngine,
  ExplanationKind,
} from "../domain";

/** Input to `explainDecision`. */
export interface ExplainDecisionInput {
  readonly kind: ExplanationKind;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/** Deps — the engine that produces the explanation. */
export interface ExplainDecisionDeps {
  readonly engine: ExplanationEngine;
}

/** `explainDecision` — produces an Explanation for the given subject. */
export function explainDecision(
  input: ExplainDecisionInput,
  deps: ExplainDecisionDeps
): Explanation {
  return deps.engine.explain(
    input.kind,
    input.subjectKind,
    input.subjectId,
    input.context
  );
}

/** `ExplainDecision` — class form of the use-case. */
export class ExplainDecision {
  constructor(private readonly deps: ExplainDecisionDeps) {}

  execute(input: ExplainDecisionInput): Explanation {
    return explainDecision(input, this.deps);
  }
}
