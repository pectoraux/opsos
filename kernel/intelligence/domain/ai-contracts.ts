/**
 * @kernel/intelligence/domain/ai-contracts — the AI integration interfaces.
 *
 * These are PORTS ONLY — no implementations live in `domain/`. Concrete
 * (deterministic mock) implementations live in
 * `infrastructure/mock-ai-providers.ts`; real AI providers (GPT, domain
 * planners, RL systems, in-house reasoning engines) implement these contracts
 * externally and are injected at the edge.
 *
 * THE GOLDEN RULE: the kernel NEVER calls an AI provider directly. The kernel
 * calls the intelligence framework (Explanation / Recommendation / Prediction /
 * Anomaly engines), which MAY be backed by an AI provider that implements one
 * of these contracts. The kernel owns WHAT intelligence means; AI providers
 * supply HOW it is produced.
 *
 * Every contract is synchronous-by-default to keep the deterministic core
 * pure; async wrappers belong at the edge (interfaces layer). All return values
 * are plain, serialisable data.
 */

/**
 * Reasoner — answers a free-form query against a context. Used by the
 * ExplanationEngine and AnomalyDetector when a deeper natural-language rationale
 * is required.
 */
export interface Reasoner {
  reason(
    query: string,
    context?: Readonly<Record<string, unknown>>
  ): {
    readonly answer: string;
    readonly confidence: number;
    readonly evidence: readonly string[];
  };
}

/** A single step in a plan produced by a Planner. */
export interface PlanStep {
  readonly step: string;
  readonly estimatedDuration: number;
}

/**
 * Planner — decomposes a goal into an ordered list of steps with estimated
 * durations. Used by the RecommendationEngine when proposing multi-step actions.
 */
export interface Planner {
  plan(goal: string, constraints?: readonly string[]): readonly PlanStep[];
}

/**
 * Predictor — forecasts a single numeric metric from opaque inputs. Distinct
 * from the domain `PredictionEngine` (which carries horizon, method, and
 * assumptions): the Predictor is the raw AI capability; the PredictionEngine
 * wraps it with operational context.
 */
export interface Predictor {
  predict(
    metric: string,
    inputs?: Readonly<Record<string, unknown>>
  ): {
    readonly value: number;
    readonly confidence: number;
    readonly method: string;
  };
}

/** A raw AI recommendation (action + rationale). */
export interface AIRecommendation {
  readonly action: string;
  readonly rationale: string;
  readonly confidence: number;
}

/**
 * Recommender — proposes raw actions for a context. The domain
 * RecommendationEngine adapts these into the structured `Recommendation` record
 * (category, impact, effort, priority).
 */
export interface Recommender {
  recommend(
    context?: Readonly<Record<string, unknown>>
  ): readonly AIRecommendation[];
}

/** An optimiser's suggestion. */
export interface OptimizationSuggestion {
  readonly suggestion: string;
  readonly expectedImprovement: number;
  readonly confidence: number;
}

/**
 * Optimizer — proposes a single optimisation for a target under constraints.
 */
export interface Optimizer {
  optimize(
    target: string,
    constraints?: readonly string[]
  ): OptimizationSuggestion;
}

/** An evaluator's verdict. */
export interface EvaluationResult {
  readonly score: number;
  readonly breakdown: Readonly<Record<string, number>>;
  readonly rationale: string;
}

/**
 * Evaluator — scores a subject against named criteria and returns a breakdown.
 */
export interface Evaluator {
  evaluate(subject: string, criteria?: readonly string[]): EvaluationResult;
}

/** A recalled memory fact. */
export interface MemoryFact {
  readonly fact: string;
  readonly confidence: number;
  readonly timestamp: number;
}

/**
 * MemoryProvider — a recall/remember store for an AI agent. Implementations may
 * be vector stores, graph stores, or simple maps. The mock implementation is a
 * plain Map with deterministic recall.
 */
export interface MemoryProvider {
  recall(query: string): readonly MemoryFact[];
  remember(fact: string, confidence: number): void;
}

/**
 * The full set of AI contracts a provider may implement. A provider need not
 * implement all of them — typically a provider specialises (e.g. an LLM
 * implements Reasoner + Recommender; an RL system implements Predictor +
 * Optimizer). The intelligence framework wires only the contracts it needs.
 */
export interface AIProviderBundle {
  readonly reasoner?: Reasoner;
  readonly planner?: Planner;
  readonly predictor?: Predictor;
  readonly recommender?: Recommender;
  readonly optimizer?: Optimizer;
  readonly evaluator?: Evaluator;
  readonly memory?: MemoryProvider;
}
