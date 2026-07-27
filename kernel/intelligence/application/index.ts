/**
 * @kernel/intelligence/application — application barrel.
 *
 * Use-cases that compose the intelligence engines into higher-level workflows.
 * The application layer depends ONLY on the domain layer (ports + types).
 *
 * Every use-case is a thin orchestrator: it delegates to an injected engine.
 * Intelligence NEVER performs work and NEVER modifies state — these use-cases
 * only READ the engines and return immutable results.
 */
export * from "./build-intelligence-graph";
export * from "./explain-decision";
export * from "./generate-recommendations";
export * from "./predict-outcome";
export * from "./detect-anomalies";
