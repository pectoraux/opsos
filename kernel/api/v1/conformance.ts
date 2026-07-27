/**
 * @kernel/api/v1 — CONFORMANCE public surface (FROZEN).
 *
 * The Kernel Conformance & Simulation Framework: validates that the kernel
 * works correctly for ANY operational business. Every future protocol must
 * pass this conformance suite before packaging (ADR-0020).
 */

// Scenario types
export type {
  Scenario,
  ScenarioInput,
  ScenarioResource,
  ScenarioCapability,
  ScenarioDemand,
  ScenarioIntent,
  ScenarioPolicy,
  ScenarioKnowledgeItem,
  ScenarioQueueConfig,
  ScenarioReservationConfig,
  ScenarioNegotiationConfig,
  ScenarioTransferConfig,
  ScenarioTwinUpdateConfig,
  ScenarioPackageConfig,
  ScenarioOutcome,
  ScenarioAssertion,
  SerializableAssertionPredicate,
  AssertionSeverity,
} from "@kernel/conformance";

// Failure injection
export type {
  FailureInjectionConfig,
  FailureInjectionKind,
} from "@kernel/conformance";

// Results
export type {
  ConformanceResult,
  AssertionResult,
  SuiteResult,
} from "@kernel/conformance";

// Metrics + explainability
export type { ConformanceMetrics } from "@kernel/conformance";
export type {
  ExplainabilityTrace,
  TraceStep,
  CompilerDecision,
  PolicyDecision,
  MatchingRationale,
  KnowledgeReference,
  EventTimelineEntry,
  ReplayVerification,
} from "@kernel/conformance";

// Simulation
export type {
  SimulationResult as ConformanceSimulationResult,
  SimulatedEvent,
  SimulatedMatch,
  SimulatedAssignment,
  SimulatedDecision,
  SimulatedTraceStep,
} from "@kernel/conformance";

// Ports
export type { ConformanceEngine } from "@kernel/conformance";
export type { SimulationEngine } from "@kernel/conformance";

// Application
export { RunConformance } from "@kernel/conformance";
export { RunSuite } from "@kernel/conformance";

// Infrastructure
export {
  DefaultConformanceEngine,
  DefaultSimulationEngine,
  DefaultExplainabilityEngine,
  DefaultFailureInjector,
  createConformanceEngine,
} from "@kernel/conformance";

// Reference scenarios
export { REFERENCE_SCENARIOS } from "@kernel/conformance";
