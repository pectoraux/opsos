/**
 * @kernel/intelligence/infrastructure/mock-ai-providers — deterministic mock
 * implementations of the AI contracts from `domain/ai-contracts.ts`.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  NOT production AI — deterministic mock for self-test.               ║
 * ║  These exist so the intelligence framework can be exercised end-to-  ║
 * ║  end without an external AI provider. Every output is a pure         ║
 * ║  function of its inputs (seeded by `hashSeed`). Real AI providers     ║
 * ║  (GPT, in-house reasoning engines, RL systems, …) implement the same ║
 * ║  contracts and are injected at the edge — the kernel never calls AI  ║
 * ║  directly.                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Determinism: NO `Date.now()` / `Math.random()`. All derived values use
 * `hashSeed` over canonical-JSON inputs. `MockMemoryProvider` sources
 * timestamps from an injected `RuntimeClock` (default 0).
 */
import { hashSeed, type RuntimeClock } from "@kernel/shared-kernel";
import type {
  Reasoner,
  Planner,
  Predictor,
  Recommender,
  Optimizer,
  Evaluator,
  MemoryProvider,
  PlanStep,
  AIRecommendation,
  OptimizationSuggestion,
  EvaluationResult,
  MemoryFact,
} from "../domain";

/** Common header stamped on every mock answer to make the mock-ness obvious. */
const MOCK_NOTE = "[mock-ai] deterministic mock — not production AI";

// ── MockReasoner ──────────────────────────────────────────────────────────

export class MockReasoner implements Reasoner {
  reason(
    query: string,
    context?: Readonly<Record<string, unknown>>
  ): {
    readonly answer: string;
    readonly confidence: number;
    readonly evidence: readonly string[];
  } {
    const seed = hashSeed(stableStringify({ query, context }));
    const confidence = 0.5 + (seed % 50) / 100; // 0.50..0.99
    return {
      answer: `${MOCK_NOTE}: reasoned about '${truncate(query, 80)}' — deterministic mock conclusion derived from input hash ${seed.toString(16).padStart(8, "0")}.`,
      confidence,
      evidence: [
        `${MOCK_NOTE}#evidence-1: hashSeed(query)`,
        `${MOCK_NOTE}#evidence-2: context-keys=${Object.keys(context ?? {}).length}`,
      ],
    };
  }
}

// ── MockPlanner ───────────────────────────────────────────────────────────

export class MockPlanner implements Planner {
  plan(goal: string, constraints?: readonly string[]): readonly PlanStep[] {
    const seed = hashSeed(stableStringify({ goal, constraints }));
    const steps: PlanStep[] = [
      {
        step: `${MOCK_NOTE}: decompose goal '${truncate(goal, 60)}'`,
        estimatedDuration: 100 + (seed % 500),
      },
      {
        step: `${MOCK_NOTE}: resolve constraints (${constraints?.length ?? 0})`,
        estimatedDuration: 200 + ((seed >> 4) % 800),
      },
      {
        step: `${MOCK_NOTE}: synthesise plan steps`,
        estimatedDuration: 150 + ((seed >> 8) % 600),
      },
    ];
    return steps;
  }
}

// ── MockPredictor ─────────────────────────────────────────────────────────

export class MockPredictor implements Predictor {
  predict(
    metric: string,
    inputs?: Readonly<Record<string, unknown>>
  ): {
    readonly value: number;
    readonly confidence: number;
    readonly method: string;
  } {
    const seed = hashSeed(stableStringify({ metric, inputs }));
    const value = (seed % 10000) / 10; // 0.0..999.9
    const confidence = 0.5 + ((seed >> 4) % 50) / 100; // 0.50..0.99
    return {
      value,
      confidence,
      method: `${MOCK_NOTE}: hash-seeded deterministic value (seed=${seed.toString(16).padStart(8, "0")})`,
    };
  }
}

// ── MockRecommender ───────────────────────────────────────────────────────

export class MockRecommender implements Recommender {
  recommend(
    context?: Readonly<Record<string, unknown>>
  ): readonly AIRecommendation[] {
    const seed = hashSeed(stableStringify({ context }));
    const recs: AIRecommendation[] = [
      {
        action: `${MOCK_NOTE}: action-A for context (hash ${seed.toString(16).padStart(8, "0")})`,
        rationale: `${MOCK_NOTE}: deterministic mock rationale derived from context hash.`,
        confidence: 0.5 + (seed % 50) / 100,
      },
      {
        action: `${MOCK_NOTE}: action-B (alternative)`,
        rationale: `${MOCK_NOTE}: secondary mock recommendation for completeness.`,
        confidence: 0.4 + ((seed >> 4) % 50) / 100,
      },
    ];
    return recs;
  }
}

// ── MockOptimizer ─────────────────────────────────────────────────────────

export class MockOptimizer implements Optimizer {
  optimize(
    target: string,
    constraints?: readonly string[]
  ): OptimizationSuggestion {
    const seed = hashSeed(stableStringify({ target, constraints }));
    const improvement = ((seed % 30) + 5) / 100; // 0.05..0.34
    return {
      suggestion: `${MOCK_NOTE}: optimise '${truncate(target, 60)}' by reducing redundant steps (seed ${seed.toString(16).padStart(8, "0")}).`,
      expectedImprovement: improvement,
      confidence: 0.5 + ((seed >> 4) % 45) / 100,
    };
  }
}

// ── MockEvaluator ─────────────────────────────────────────────────────────

export class MockEvaluator implements Evaluator {
  evaluate(
    subject: string,
    criteria?: readonly string[]
  ): EvaluationResult {
    const cs = criteria && criteria.length > 0 ? criteria : ["correctness", "efficiency", "clarity"];
    const seed = hashSeed(stableStringify({ subject, criteria: cs }));
    const breakdown: Record<string, number> = {};
    let sum = 0;
    for (let i = 0; i < cs.length; i++) {
      const raw = ((seed >> (i * 3)) % 41) + 60; // 60..100
      breakdown[cs[i]] = raw / 100; // 0.60..1.00
      sum += raw;
    }
    const score = sum / cs.length / 100;
    return {
      score,
      breakdown,
      rationale: `${MOCK_NOTE}: score for '${truncate(subject, 60)}' is a deterministic function of subject + criteria hash (${seed.toString(16).padStart(8, "0")}).`,
    };
  }
}

// ── MockMemoryProvider ────────────────────────────────────────────────────

export interface MockMemoryProviderOptions {
  readonly clock?: RuntimeClock;
}

export class MockMemoryProvider implements MemoryProvider {
  private readonly clock: RuntimeClock | undefined;
  private readonly facts = new Map<string, MemoryFact>();

  constructor(options: MockMemoryProviderOptions = {}) {
    this.clock = options.clock;
  }

  remember(fact: string, confidence: number): void {
    const timestamp = this.clock ? this.clock.now() : 0;
    this.facts.set(fact, { fact, confidence: clamp01(confidence), timestamp });
  }

  recall(query: string): readonly MemoryFact[] {
    const tokens = query
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return [];
    const matching: MemoryFact[] = [];
    for (const f of this.facts.values()) {
      const lower = f.fact.toLowerCase();
      if (tokens.some((t) => lower.includes(t))) {
        matching.push(f);
      }
    }
    matching.sort((a, b) =>
      b.confidence !== a.confidence
        ? b.confidence - a.confidence
        : a.timestamp !== b.timestamp
          ? a.timestamp - b.timestamp
          : a.fact < b.fact
            ? -1
            : a.fact > b.fact
              ? 1
              : 0
    );
    return matching.slice(0, 10);
  }

  /** Introspection: total stored fact count. */
  size(): number {
    return this.facts.size;
  }
}

// ── Convenience factory: a fully-wired bundle of mock providers ────────────

export interface MockAIProviderBundle {
  readonly reasoner: MockReasoner;
  readonly planner: MockPlanner;
  readonly predictor: MockPredictor;
  readonly recommender: MockRecommender;
  readonly optimizer: MockOptimizer;
  readonly evaluator: MockEvaluator;
  readonly memory: MockMemoryProvider;
}

export interface CreateMockAIProvidersOptions {
  readonly clock?: RuntimeClock;
}

/**
 * `createMockAIProviders` — builds a fresh, fully-wired bundle of deterministic
 * mock AI providers. All share the same injected clock (for `MockMemoryProvider`
 * timestamps). Clearly marked NOT production AI.
 */
export function createMockAIProviders(
  options: CreateMockAIProvidersOptions = {}
): MockAIProviderBundle {
  return {
    reasoner: new MockReasoner(),
    planner: new MockPlanner(),
    predictor: new MockPredictor(),
    recommender: new MockRecommender(),
    optimizer: new MockOptimizer(),
    evaluator: new MockEvaluator(),
    memory: new MockMemoryProvider({ clock: options.clock }),
  };
}

// ── Deterministic helpers ─────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
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
