/**
 * @kernel/conformance/domain — domain barrel.
 *
 * Re-exports every scenario/result/port type so a single
 * `import { Scenario, ConformanceResult, ... } from "@kernel/conformance/domain"`
 * resolves the full domain surface.
 */
export * from "./scenario-input";
export * from "./scenario-outcome";
export * from "./scenario-assertion";
export * from "./failure-injection";
export * from "./scenario";
export * from "./conformance-metrics";
export * from "./explainability";
export * from "./conformance-result";
export * from "./simulation-engine";
export * from "./conformance-engine";
