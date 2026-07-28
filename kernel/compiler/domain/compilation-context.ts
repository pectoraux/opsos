/**
 * @kernel/compiler/domain/compilation-context — the intermediate representation
 * (IR) that flows through the compiler pipeline.
 *
 * The `CompilationContext` is the accumulator: each stage reads it and returns
 * a new context with additional state in `CompilationState`. It is immutable —
 * `with()` returns a new context; stages never mutate in place. This keeps
 * compilation replayable: the same `(intent, ctx)` through the same stages
 * produces byte-identical state.
 *
 * The context carries the `Intent` being compiled, the deterministic runtime
 * handles (clock, random), the principal/tenant/correlation scoping, and a
 * READ-ONLY handle to the `ExtensionRegistry` (so stages can look up
 * capabilities, intent types, and policies registered by protocols).
 */

import type {
  Intent,
  RuntimeClock,
  RandomSource,
  PrincipalId,
  TenantId,
  Demand,
  Capability,
  Task,
  ExecutionPlan,
  Decision,
  Observation,
  Twin,
  Result,
  KernelError,
} from "@kernel/shared-kernel";
import type { ExecutionGraph } from "@kernel/runtime";
import type { ExtensionRegistry } from "@kernel/extension";
import type { IntentTypeRegistration } from "@kernel/extension";
import type { CompilerDiagnostic } from "./diagnostic";

/**
 * The accumulated compilation state. Every field is optional except
 * `diagnostics` (always present, grows as stages run). Stages populate the
 * fields relevant to their phase; later stages read earlier fields.
 */
export interface CompilationState {
  /** Intent after normalization (defaults filled, payload validated). */
  readonly normalizedIntent?: Intent;
  /** The intent-type registration matching `intent.type`, if a protocol declared one. */
  readonly intentTypeRegistration?: IntentTypeRegistration;
  /** Policy decision gating compilation. `deny` aborts the pipeline. */
  readonly policyDecision?: Decision;
  /** Demands derived from the intent by the capability resolver / planner. */
  readonly demands: readonly Demand[];
  /** Capabilities resolved from the registry as candidates for the intent type. */
  readonly capabilities: readonly Capability[];
  /** Tasks produced by the planner. */
  readonly tasks: readonly Task[];
  /** The execution plan (draft after planner, optimized after optimizer). */
  readonly plan?: ExecutionPlan;
  /** Schedule produced by the scheduler stage (may be empty under NoopScheduler). */
  readonly schedule?: import("@kernel/shared-kernel").Schedule;
  /** Routes produced by the router stage. */
  readonly routes: readonly import("@kernel/shared-kernel").Route[];
  /** The final execution graph (after the graph-builder stage). */
  readonly graph?: ExecutionGraph; // from @kernel/runtime
  /** Diagnostics accumulated across stages (warnings, info, non-fatal notices). */
  readonly diagnostics: readonly CompilerDiagnostic[];
  /** Observations consulted during compilation (feedback into planning). */
  readonly observations: readonly Observation[];
  /** The twin consulted during compilation (modeled state), if any. */
  readonly twin?: Twin;
}

/** The empty initial state. */
export function emptyCompilationState(): CompilationState {
  return {
    demands: [],
    capabilities: [],
    tasks: [],
    routes: [],
    diagnostics: [],
    observations: [],
  };
}

/**
 * The immutable context threaded through the pipeline.
 *
 * `with(partial)` returns a NEW context with `state` shallow-merged with
 * `partial`. The runtime handles (clock, random, registry, scoping) are shared
 * by reference — only `state` is replaced.
 */
export interface CompilationContext {
  readonly intent: Intent;
  readonly clock: RuntimeClock;
  readonly random: RandomSource;
  readonly principalId: PrincipalId | null;
  readonly tenantId: TenantId | null;
  readonly correlationId: string;
  /** Read-only handle to the protocol registry (capabilities, intent types, policies). */
  readonly registry: ExtensionRegistry;
  readonly state: CompilationState;
  /** Returns a new context with `state` merged with `partial`. Pure. */
  with(partial: Partial<CompilationState>): CompilationContext;
}

/**
 * Private immutable implementation. `with` clones with a merged state.
 */
class CompilationContextImpl implements CompilationContext {
  constructor(
    readonly intent: Intent,
    readonly clock: RuntimeClock,
    readonly random: RandomSource,
    readonly principalId: PrincipalId | null,
    readonly tenantId: TenantId | null,
    readonly correlationId: string,
    readonly registry: ExtensionRegistry,
    readonly state: CompilationState
  ) {}

  with(partial: Partial<CompilationState>): CompilationContext {
    return new CompilationContextImpl(
      this.intent,
      this.clock,
      this.random,
      this.principalId,
      this.tenantId,
      this.correlationId,
      this.registry,
      { ...this.state, ...partial }
    );
  }
}

/** Dependencies required to build a `CompilationContext`. */
export interface CompilationContextDeps {
  readonly clock: RuntimeClock;
  readonly random: RandomSource;
  readonly principalId?: PrincipalId | null;
  readonly tenantId?: TenantId | null;
  readonly correlationId?: string;
  readonly registry: ExtensionRegistry;
}

/** Build a `CompilationContext` for `intent` from the given deps. */
export function createCompilationContext(
  intent: Intent,
  deps: CompilationContextDeps
): CompilationContext {
  return new CompilationContextImpl(
    intent,
    deps.clock,
    deps.random,
    deps.principalId ?? null,
    deps.tenantId ?? null,
    deps.correlationId ?? `compile:${intent.id}`,
    deps.registry,
    emptyCompilationState()
  );
}
