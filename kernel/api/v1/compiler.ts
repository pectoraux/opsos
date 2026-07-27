/**
 * @kernel/api/v1 — COMPILER public surface (FROZEN).
 *
 * The Intent → ExecutionGraph compiler framework. Per ADR-0011 the compiler
 * is the ONLY component that creates work; the runtime only executes it.
 *
 * See `@kernel/compiler` for the full implementation.
 */
export type {
  CompilationContext,
  CompilationState,
  CompilationContextDeps,
  CompilerStage,
  CompilerPhase,
  CompilerPipeline,
  CompilerOptions,
  CompilerResult,
  CompilerDiagnostic,
  DiagnosticSeverity,
  StageTrace,
  AbortCompilationError,
  StageFailedError,
} from "@kernel/compiler";

export {
  compile,
  DefaultCompilerPipeline,
  createCompilationContext,
  // Kernel-provided stages (each replaceable; protocols may register more):
  NormalizerStage,
  ValidatorStage,
  PolicyEvaluatorStage,
  CapabilityResolverStage,
  PlannerStage,
  OptimizerStage,
  SchedulerStage,
  RouterStage,
  GraphBuilderStage,
  createDefaultStages,
} from "@kernel/compiler";
