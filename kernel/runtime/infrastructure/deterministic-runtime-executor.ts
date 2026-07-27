/**
 * @kernel/runtime/infrastructure/deterministic-runtime-executor — the reference
 * `RuntimeExecutor` implementation.
 *
 * Algorithm:
 *   1. Compute the deterministic topological order via `topologicalOrder()`.
 *      On cycle / malformed graph → return an `ExecutionResult` with
 *      `ok: false`, no steps, no events, `finalState = inputState`.
 *   2. Walk nodes in that order. For each node:
 *        a. If any dependency was `failed` or `skipped` → mark this node
 *           `skipped` (it cannot run safely).
 *        b. Resolve the handler from the injected `OperationRegistry`. If no
 *           handler is registered for the ref → mark `failed`.
 *        c. Build an `OperationContext` (parent ctx + node inputs) and invoke
 *           the handler. On success → mark `completed`, merge `outputs` into
 *           `RuntimeState` via `state.set(key, value)`, and collect emitted
 *           `EventInput`s. On throw → mark `failed` with the error message.
 *   3. Wrap collected `EventInput`s into `EventEnvelope`s (eventId from
 *      `ctx.random.uuid()`, streamId from `aggregateStreamId`, version from a
 *      per-stream monotonic counter, timestamp from the input — which the op
 *      sourced from `ctx.clock`). If an `EventStore` was injected, append per
 *      stream with `ANY_VERSION` and use the store's authoritative envelopes
 *      (real versions); on append failure, log and fall back to the
 *      executor-wrapped envelopes for that stream.
 *   4. Build `ExecutionResult`. `ok` is `true` iff no step is `failed`/`skipped`.
 *
 * Ordering is deterministic: ties in the topological order are broken by
 * lexicographic node-id order (see `topologicalOrder`), NEVER by timing.
 */

import type { StreamId, Result, ConcurrencyConflictError } from "@kernel/shared-kernel";
import { asId, ANY_VERSION, aggregateStreamId } from "@kernel/shared-kernel";
import type {
  EventEnvelope,
  EventInput,
  EventStore,
} from "@kernel/events";
import type { AppendResult } from "@kernel/events";

import type {
  ExecutionGraph,
  ExecutionNode,
} from "../domain/execution-graph";
import { topologicalOrder } from "../domain/execution-graph";
import type { RuntimeState } from "../domain/runtime-state";
import type {
  ExecutionResult,
  ExecutionStepResult,
} from "../domain/execution-result";
import type { RuntimeExecutor } from "../domain/runtime-executor";
import type { ExecutionContext } from "../domain/execution-context";
import type {
  OperationContext,
  OperationRegistry,
  OperationResult,
} from "../domain/operation";
import { createOperationContext } from "../domain/operation";

export interface DeterministicRuntimeExecutorDeps {
  /** Registry from which node operation refs are resolved. */
  readonly registry: OperationRegistry;
  /** Optional event store. If provided, emitted events are appended per stream. */
  readonly eventStore?: EventStore;
}

export class DeterministicRuntimeExecutor implements RuntimeExecutor {
  constructor(private readonly deps: DeterministicRuntimeExecutorDeps) {}

  async execute(
    graph: ExecutionGraph,
    inputState: RuntimeState,
    ctx: ExecutionContext
  ): Promise<ExecutionResult> {
    const startedAt = ctx.clock.now();

    // 1. Deterministic topological order.
    const order = topologicalOrder(graph);
    if (!order.ok) {
      const endedAt = ctx.clock.now();
      return {
        graphId: graph.id,
        steps: [],
        eventsEmitted: [],
        finalState: inputState,
        startedAt,
        endedAt,
        seed: graph.seed,
        ok: false,
      };
    }

    // Index nodes by id for fast lookup during execution.
    const nodesById = new Map<string, ExecutionNode>();
    for (const n of graph.nodes) nodesById.set(n.id, n);

    const steps: ExecutionStepResult[] = [];
    const collectedEvents: EventInput[] = [];
    const failedOrSkipped = new Set<string>();
    let state: RuntimeState = inputState;

    // 2. Walk in deterministic topological order.
    for (const nodeId of order.value) {
      const node = nodesById.get(nodeId)!;

      // a. Skip if any dependency failed or was skipped.
      const depBlocked = node.dependsOn.some((dep) => failedOrSkipped.has(dep));
      if (depBlocked) {
        const t = ctx.clock.now();
        steps.push({
          nodeId,
          status: "skipped",
          startedAt: t,
          endedAt: t,
        });
        failedOrSkipped.add(nodeId);
        continue;
      }

      // b. Resolve handler.
      const handler = this.deps.registry.resolve(node.operation);
      const nodeStartedAt = ctx.clock.now();
      if (!handler) {
        steps.push({
          nodeId,
          status: "failed",
          error: `Operation not registered: ${node.operation.name}@${node.operation.version}`,
          startedAt: nodeStartedAt,
          endedAt: ctx.clock.now(),
        });
        failedOrSkipped.add(nodeId);
        continue;
      }

      // c. Build context + invoke.
      const opCtx: OperationContext = createOperationContext(ctx, node.inputs);
      try {
        const result: OperationResult = await handler(opCtx);
        // Merge outputs into state (each key → state.set).
        for (const key of Object.keys(result.outputs)) {
          state = state.set(key, (result.outputs as Record<string, unknown>)[key]);
        }
        // Collect emitted events (preserving emission order).
        for (const ev of result.events) collectedEvents.push(ev);
        steps.push({
          nodeId,
          status: "completed",
          outputs: result.outputs,
          startedAt: nodeStartedAt,
          endedAt: ctx.clock.now(),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        steps.push({
          nodeId,
          status: "failed",
          error: message,
          startedAt: nodeStartedAt,
          endedAt: ctx.clock.now(),
        });
        failedOrSkipped.add(nodeId);
      }
    }

    // 3. Wrap collected EventInputs into envelopes; append to store if provided.
    const eventsEmitted = await this.materializeEvents(collectedEvents, ctx);

    const endedAt = ctx.clock.now();
    const ok = failedOrSkipped.size === 0;

    return {
      graphId: graph.id,
      steps,
      eventsEmitted,
      finalState: state,
      startedAt,
      endedAt,
      seed: graph.seed,
      ok,
    };
  }

  /**
   * Wrap `EventInput`s into `EventEnvelope`s. If an `EventStore` was injected,
   * append per stream with `ANY_VERSION` and prefer the store's authoritative
   * envelopes (which carry real per-stream versions). On append failure, log a
   * warning and fall back to the executor-wrapped envelopes for that stream.
   *
   * The `eventId` for executor-wrapped envelopes comes from `ctx.random.uuid()`
   * so it is deterministic for a given seed; the store's own `eventId`
   * generator (configured at construction) is used when appending.
   */
  private async materializeEvents(
    inputs: readonly EventInput[],
    ctx: ExecutionContext
  ): Promise<readonly EventEnvelope[]> {
    if (inputs.length === 0) return [];

    // Group by stream so each stream's versions are monotonic and contiguous.
    const streamKey = (i: EventInput): string =>
      String(aggregateStreamId(i.aggregateType, String(i.aggregateId)));

    const groups = new Map<string, EventInput[]>();
    for (const input of inputs) {
      const key = streamKey(input);
      const bucket = groups.get(key);
      if (bucket) bucket.push(input);
      else groups.set(key, [input]);
    }

    const out: EventEnvelope[] = [];

    if (this.deps.eventStore) {
      for (const [key, bucket] of groups) {
        const streamId: StreamId = asId<"StreamId">(key);
        const appendRes: Result<
          AppendResult,
          ConcurrencyConflictError
        > = await this.deps.eventStore.append(streamId, bucket, ANY_VERSION);
        if (appendRes.ok) {
          for (const e of appendRes.value.appended) out.push(e);
        } else {
          ctx.observability.logger.warn(
            "DeterministicRuntimeExecutor: event store append failed; using executor-wrapped envelopes",
            {
              streamId: key,
              error: appendRes.error.message,
              count: bucket.length,
            }
          );
          for (const e of this.wrapLocally(bucket, ctx)) out.push(e);
        }
      }
    } else {
      for (const bucket of groups.values()) {
        for (const e of this.wrapLocally(bucket, ctx)) out.push(e);
      }
    }

    return out;
  }

  /**
   * Wrap a per-stream bucket of `EventInput`s into envelopes with
   * executor-assigned, per-stream monotonic versions (1-based) and
   * `eventId`s from `ctx.random.uuid()`. Deterministic for a given seed.
   */
  private wrapLocally(
    bucket: readonly EventInput[],
    ctx: ExecutionContext
  ): EventEnvelope[] {
    let version = 0;
    const result: EventEnvelope[] = [];
    for (const input of bucket) {
      version += 1;
      const streamId = aggregateStreamId(
        input.aggregateType,
        String(input.aggregateId)
      );
      result.push({
        eventId: asId<"EventId">(ctx.random.uuid()),
        streamId,
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        eventType: input.eventType,
        timestamp: input.timestamp,
        version,
        metadata: input.metadata,
        payload: input.payload,
      });
    }
    return result;
  }
}
