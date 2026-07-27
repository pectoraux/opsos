/**
 * @kernel/conformance/infrastructure — infrastructure barrel.
 *
 * Re-exports the default engine implementations and the `createConformanceEngine()`
 * factory. Callers who want a fully-wired default engine can use:
 *
 *   import { createConformanceEngine } from "@kernel/conformance";
 *   const engine = createConformanceEngine();
 *   const result = engine.runScenario(scenario);
 *
 * Callers who want to inject custom engines (e.g. a recording SimulationEngine
 * for property-based testing) can construct the parts directly:
 *
 *   import { DefaultConformanceEngine, DefaultSimulationEngine } from "@kernel/conformance";
 *   const engine = new DefaultConformanceEngine(new MyRecordingSimulationEngine());
 */
export * from "./default-failure-injector";
export * from "./default-simulation-engine";
export * from "./default-explainability-engine";
export * from "./default-conformance-engine";
