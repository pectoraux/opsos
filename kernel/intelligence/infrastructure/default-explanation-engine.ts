/**
 * @kernel/intelligence/infrastructure/default-explanation-engine —
 * `DefaultExplanationEngine`.
 *
 * Deterministic, rule-based `ExplanationEngine`. Produces an Explanation by:
 *   1. gathering evidence from the injected `IntelligenceGraph` (the subject's
 *      neighbours) plus any caller-supplied `context.evidence`;
 *   2. templating a per-`ExplanationKind` rationale;
 *   3. deriving a deterministic `confidence` from evidence count + graph
 *      presence;
 *   4. listing per-kind assumptions and alternative paths;
 *   5. stamping provenance (source event ids + an input hash of the context).
 *
 * This is NOT an AI. It is a deterministic baseline so the intelligence
 * contracts can be exercised in self-test and conformance. AI-backed
 * explanation engines implement the same port and slot in later — the kernel
 * never calls them directly.
 *
 * Determinism: NO `Date.now()` / `Math.random()`. The same
 * (kind, subjectKind, subjectId, context, graph) ALWAYS produces the same
 * Explanation.
 */
import { hashSeed } from "@kernel/shared-kernel";
import type {
  Explanation,
  ExplanationEngine,
  ExplanationKind,
  AlternativePath,
  ExplanationEvidence,
  IntelligenceGraph,
} from "../domain";

export interface DefaultExplanationEngineOptions {
  readonly graph?: IntelligenceGraph;
}

export class DefaultExplanationEngine implements ExplanationEngine {
  private readonly graph: IntelligenceGraph | undefined;

  constructor(options: DefaultExplanationEngineOptions = {}) {
    this.graph = options.graph;
  }

  explain(
    kind: ExplanationKind,
    subjectKind: string,
    subjectId: string,
    context?: Readonly<Record<string, unknown>>
  ): Explanation {
    const ctx = context ?? {};

    // ── 1. Gather evidence ─────────────────────────────────────────────
    const evidence: ExplanationEvidence[] = [];
    if (this.graph) {
      const neighbors = this.graph.getNeighbors(subjectId, "both");
      for (const n of neighbors) {
        evidence.push({
          source: n.kind,
          reference: n.id,
          confidence: 0.7,
        });
      }
    }
    const ctxEvidence = readArray<ExplanationEvidence>(ctx, "evidence");
    for (const e of ctxEvidence) {
      evidence.push({
        source: String(e.source ?? "context"),
        reference: String(e.reference ?? ""),
        confidence: clamp01(Number(e.confidence ?? 0.5)),
      });
    }

    // ── 2. Provenance ──────────────────────────────────────────────────
    const sourceEventIds: string[] = [];
    const ctxEventIds = readArray<string>(ctx, "eventIds");
    for (const id of ctxEventIds) sourceEventIds.push(String(id));
    if (this.graph && sourceEventIds.length === 0) {
      const neighbors = this.graph.getNeighbors(subjectId, "both");
      for (const n of neighbors) {
        if (n.kind === "event") sourceEventIds.push(n.id);
      }
    }
    const inputHash = hashSeed(stableStringify(ctx)).toString(16).padStart(8, "0");

    // ── 3. Confidence ──────────────────────────────────────────────────
    const subjectInGraph = this.graph?.getNode(subjectId) !== undefined;
    let confidence = 0.4 + 0.1 * Math.min(evidence.length, 5);
    if (subjectInGraph) confidence += 0.05;
    confidence = clamp01(Math.min(confidence, 0.95));

    // ── 4. Rationale + assumptions + alternatives (per kind) ───────────
    const template = EXPLANATION_TEMPLATES[kind];
    const rationale = template.rationale(subjectKind, subjectId, ctx);
    const assumptions = template.assumptions;
    const alternativePaths = template.alternativePaths;

    return {
      kind,
      subjectKind,
      subjectId,
      rationale,
      evidence,
      provenance: { sourceEventIds, inputHash },
      confidence,
      assumptions,
      alternativePaths,
    };
  }
}

// ── Per-kind explanation templates ────────────────────────────────────────

interface ExplanationTemplate {
  readonly rationale: (
    subjectKind: string,
    subjectId: string,
    ctx: Readonly<Record<string, unknown>>
  ) => string;
  readonly assumptions: readonly string[];
  readonly alternativePaths: readonly AlternativePath[];
}

const EXPLANATION_TEMPLATES: Record<ExplanationKind, ExplanationTemplate> = {
  "compiler-decision": {
    rationale: (sk, sid, ctx) => {
      const stage = readString(ctx, "stage") || "graph-build";
      return `Compiler decision for ${sk} '${sid}' at stage '${stage}': the node was admitted because it satisfied the stage's structural and semantic invariants.`;
    },
    assumptions: [
      "The compiler version matches the protocol's declared compilerVersion.",
      "No failure-injection short-circuited the stage.",
    ],
    alternativePaths: [
      {
        description: "Reject the node at validation",
        outcome: "Compilation fails with a validation diagnostic.",
        rejectedReason: "All validation invariants were satisfied.",
      },
    ],
  },
  "policy-evaluation": {
    rationale: (sk, sid, ctx) => {
      const effect = readString(ctx, "effect") || "allow";
      return `Policy evaluation for ${sk} '${sid}' resolved to '${effect}' by matching the first applicable rule in priority order.`;
    },
    assumptions: [
      "Policy rules were evaluated in declared priority order.",
      "No rule side-effects mutated the decision inputs.",
    ],
    alternativePaths: [
      {
        description: "Apply the next-priority rule",
        outcome: "A different effect (deny / warn) would be produced.",
        rejectedReason: "The first-priority matching rule was authoritative.",
      },
    ],
  },
  "resource-selection": {
    rationale: (sk, sid, ctx) => {
      const score = readNumber(ctx, "score");
      return `Resource '${sid}' was selected for ${sk} with deterministic match score ${score} (operational state × capability level).`;
    },
    assumptions: [
      "Capability and availability data was current at evaluation time.",
      "Ties were broken by resource id ascending (deterministic).",
    ],
    alternativePaths: [
      {
        description: "Select the next-highest-scoring resource",
        outcome: "A different resource would be assigned.",
        rejectedReason: "The selected resource had the highest score.",
      },
    ],
  },
  coordination: {
    rationale: (sk, sid) =>
      `Coordination decision for ${sk} '${sid}': the commitment/assignment was made because the offering resource had available capacity and no higher-priority claimant was waiting.`,
    assumptions: [
      "Commitment capacity was tracked across demands within the coordination cycle.",
      "Reservation expiry was honoured.",
    ],
    alternativePaths: [
      {
        description: "Defer the demand to the queue",
        outcome: "The demand would be queued rather than committed.",
        rejectedReason: "Capacity was available at decision time.",
      },
    ],
  },
  scheduling: {
    rationale: (sk, sid, ctx) => {
      const slot = readString(ctx, "slot") || "earliest";
      return `Scheduling decision for ${sk} '${sid}': assigned to the '${slot}' slot that satisfied all hard constraints and minimised the objective function.`;
    },
    assumptions: [
      "Calendar entries were conflict-checked against existing commitments.",
      "The objective function was deterministic given the inputs.",
    ],
    alternativePaths: [
      {
        description: "Schedule into the next-available slot",
        outcome: "A later slot would be chosen.",
        rejectedReason: "The earliest feasible slot was selected.",
      },
    ],
  },
  "package-validation": {
    rationale: (sk, sid, ctx) => {
      const stage = readString(ctx, "stage") || "validate";
      return `Package validation for ${sk} '${sid}' at stage '${stage}' produced no error-severity diagnostics; the package is structurally sound.`;
    },
    assumptions: [
      "Semantic, knowledge, resource, workflow, and policy integrity were all checked.",
      "Unknown refs were treated as warnings, not errors.",
    ],
    alternativePaths: [
      {
        description: "Fail validation on unknown refs",
        outcome: "The package would be rejected.",
        rejectedReason: "Unknown refs may reference items from other protocols.",
      },
    ],
  },
  "protocol-installation": {
    rationale: (sk, sid) =>
      `Protocol installation for ${sk} '${sid}': the package transitioned discovered → validated → linked → packaged → verified → installed → activated without illegal-state errors.`,
    assumptions: [
      "The installer never calls Date.now(); install time is the package buildTimestamp.",
      "Re-install of an already-installed version is an idempotent no-op walk.",
    ],
    alternativePaths: [
      {
        description: "Install without activation",
        outcome: "The package would remain in 'installed' state.",
        rejectedReason: "Activation was requested and succeeded.",
      },
    ],
  },
  "conformance-failure": {
    rationale: (sk, sid, ctx) => {
      const assertionId = readString(ctx, "assertionId") || "unknown";
      return `Conformance failure for ${sk} '${sid}': assertion '${assertionId}' did not hold against the simulated outcome, OR replay verification failed.`;
    },
    assumptions: [
      "The simulation was run twice for replay verification.",
      "Assertion severity was respected (error/fatal failures fail the scenario).",
    ],
    alternativePaths: [
      {
        description: "Treat the assertion as a warning",
        outcome: "The scenario would pass despite the mismatch.",
        rejectedReason: "The assertion was declared at error severity.",
      },
    ],
  },
};

// ── Deterministic context readers ─────────────────────────────────────────

function readArray<T>(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): T[] {
  const v = ctx[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function readString(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): string {
  const v = ctx[key];
  return typeof v === "string" ? v : "";
}

function readNumber(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): number {
  const v = ctx[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Stable, key-sorted JSON serialisation for deterministic hashing. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}
