/**
 * @kernel/runtime/domain/operation — the operation port + registry.
 *
 * An `OperationHandler` is a pure-ish function `(OperationContext) → OperationResult`
 * invoked by the `RuntimeExecutor` for each graph node. It receives the
 * `ExecutionContext` (clock, random, observability, config, identity, trace)
 * plus the node's `inputs`. It returns `outputs` (merged into `RuntimeState`
 * by the executor) and `events` (emitted by the op, sourced through
 * `ctx.clock` for timestamps).
 *
 * Handlers are referenced from `ExecutionNode.operation` by `(name, version)`
 * via `OperationRef`. The `OperationRegistry` maps refs to handlers; it is an
 * explicit, injected object — NEVER a module-level singleton — to preserve
 * determinism and testability.
 */

import type { EventInput } from "@kernel/events";
import type { ExecutionContext, ExecutionContextOverrides } from "./execution-context";

/**
 * The context handed to an `OperationHandler`: the parent `ExecutionContext`
 * plus this node's `inputs`.
 */
export interface OperationContext extends ExecutionContext {
  /** Inputs declared on the `ExecutionNode` that triggered this operation. */
  readonly nodeInputs: Readonly<Record<string, unknown>>;
}

/** What an operation produces: merged outputs + events to emit. */
export interface OperationResult {
  /** Merged into `RuntimeState` by the executor (each key → `state.set(key, value)`). */
  readonly outputs: Readonly<Record<string, unknown>>;
  /** Events the op emits. Timestamps MUST be sourced from `ctx.clock`. */
  readonly events: readonly EventInput[];
}

/** A handler may be sync or async; the executor always `await`s it. */
export type OperationHandler = (
  ctx: OperationContext
) => Promise<OperationResult> | OperationResult;

/** A versioned, content-addressable reference to a registered handler. */
export interface OperationRef {
  readonly name: string;
  readonly version: number;
}

/**
 * Registry of operation handlers. Explicit, injectable, instance-scoped —
 * never a module-level singleton (determinism rule: no hidden mutable state).
 */
export interface OperationRegistry {
  /** Register a handler for a ref. Throws on duplicate ref registration. */
  register(ref: OperationRef, handler: OperationHandler): void;
  /** Resolve a handler for a ref, or `undefined` if none registered. */
  resolve(ref: OperationRef): OperationHandler | undefined;
  /** Snapshot of all registered refs. */
  list(): readonly OperationRef[];
}

/**
 * Build an `OperationContext` from a parent `ExecutionContext` plus the node's
 * inputs. Pure: returns a new object; `derive()` delegates to the parent so the
 * shared deps (clock/random/observability/config) are shared by reference.
 */
export function createOperationContext(
  ctx: ExecutionContext,
  nodeInputs: Readonly<Record<string, unknown>>
): OperationContext {
  return {
    clock: ctx.clock,
    random: ctx.random,
    observability: ctx.observability,
    config: ctx.config,
    principalId: ctx.principalId,
    tenantId: ctx.tenantId,
    correlationId: ctx.correlationId,
    traceId: ctx.traceId,
    causationId: ctx.causationId,
    metadata: ctx.metadata,
    derive: (overrides?: Partial<ExecutionContextOverrides>): ExecutionContext =>
      ctx.derive(overrides),
    nodeInputs,
  };
}
