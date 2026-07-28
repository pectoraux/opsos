# Task 3-b — runtime module (agent: runtime-module)

## Outcome
Built the kernel **runtime** module — the deterministic execution engine.
17 files under `/home/z/my-project/kernel/runtime/`. tsc `--noEmit` passes with
ZERO errors in `kernel/runtime` and ZERO errors outside `skills/`.

## Files produced
```
kernel/runtime/
├── domain/
│   ├── execution-context.ts        ExecutionContext interface + ExecutionContextOverrides
│   ├── execution-graph.ts          ExecutionGraph/Node/Edge, NodeStatus, topologicalOrder()
│   ├── operation.ts                OperationContext, OperationResult, OperationHandler, OperationRef, OperationRegistry, createOperationContext()
│   ├── runtime-state.ts            RuntimeState interface + createRuntimeState()
│   ├── execution-result.ts         ExecutionResult, ExecutionStepResult
│   ├── runtime-executor.ts         RuntimeExecutor PORT
│   └── index.ts                    barrel
├── application/
│   ├── execution-context-builder.ts  ExecutionContextBuilder + createExecutionContext + ExecutionContextDeps
│   ├── execute-graph.ts              ExecuteGraphUseCase + createExecuteGraph
│   └── index.ts                      barrel
├── infrastructure/
│   ├── system-runtime-clock.ts       SystemRuntimeClock  ← ONLY Date.now() site
│   ├── fixed-runtime-clock.ts        FixedRuntimeClock (extends shared-kernel FixedClock)
│   ├── seeded-random-source.ts       SeededRandomSource (mulberry32-based; deterministic uuid/int/pick/shuffle)
│   ├── deterministic-runtime-executor.ts  DeterministicRuntimeExecutor + deps type
│   └── index.ts                      barrel + createOperationRegistry()
├── interfaces/
│   └── index.ts                    public barrel (re-exports domain + application + infrastructure)
└── index.ts                        root entry → ./interfaces
```

## Public surface exported from `@kernel/runtime`
- **Context & types:** `ExecutionContext`, `ExecutionContextOverrides`,
  `ExecutionContextDeps`, `ExecutionContextBuilder`, `createExecutionContext`.
- **Graph:** `ExecutionGraph`, `ExecutionNode`, `ExecutionEdge`, `NodeStatus`,
  `topologicalOrder`.
- **Operation:** `OperationContext`, `OperationResult`, `OperationHandler`,
  `OperationRef`, `OperationRegistry`, `createOperationContext`.
- **State & result:** `RuntimeState`, `createRuntimeState`, `ExecutionResult`,
  `ExecutionStepResult`.
- **Executor:** `RuntimeExecutor` (port), `DeterministicRuntimeExecutor`,
  `DeterministicRuntimeExecutorDeps`, `ExecuteGraphUseCase`,
  `ExecuteGraphUseCaseDeps`, `createExecuteGraph`.
- **Clocks:** `SystemRuntimeClock`, `FixedRuntimeClock`.
- **Random:** `SeededRandomSource`.
- **Registry factory:** `createOperationRegistry`.

## Key decisions
1. **`derive()`** returns a NEW context; shared deps (clock/random/observability/config)
   passed by reference; `!== undefined` check distinguishes "not supplied" from
   "supplied as null/undefined" so callers can clear a field explicitly.
2. **`topologicalOrder()`**: Kahn's algorithm with lexicographic tie-break
   (binary-insert into the ready set). Honors BOTH `node.dependsOn` AND `graph.edges`.
   Cycles, unknown refs, duplicate ids → `DeterminismViolationError`.
3. **`RuntimeState`**: `apply(event)` advances `version` (data unchanged —
   domain-specific reducers live in domain aggregates, not this generic bag);
   `set(key, value)` returns a new state with merged data. Both pure.
4. **`DeterministicRuntimeExecutor`**: walks deterministic topo order; skips
   nodes whose deps failed/skipped; merges each node's `outputs` into state via
   `state.set`; collects `EventInput[]`; wraps them into envelopes with
   `eventId` from `ctx.random.uuid()`, `streamId` from `aggregateStreamId`,
   per-stream monotonic version, `timestamp` from the input. If an `EventStore`
   is injected, appends per stream with `ANY_VERSION` and prefers the store's
   authoritative envelopes (real versions); falls back to executor-wrapped
   envelopes on append failure (logged via observability). `ok` = no
   failed/skipped steps. On topo failure → returns `ok:false` result with empty
   steps and `finalState = inputState`.
5. **`createOperationRegistry()`** lives in `infrastructure/index.ts` (instance-scoped
   Map, no module-level state); throws on duplicate `(name, version)` registration.
6. **`OperationContext`** built via the pure `createOperationContext(ctx, nodeInputs)`
   factory in domain/operation.ts; `derive()` delegates to the parent ctx.
7. **`FixedRuntimeClock`** extends shared-kernel's `FixedClock` base.
8. **`SeededRandomSource.uuid()`** generates 16 stream bytes, sets v4 version nibble
   (0x40) and variant bits (0x80), formats as `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.
   Deterministic for a given seed.
9. **`ExecuteGraphUseCase`** opens an observability span around `executor.execute`,
   records outcome attributes, delegates to the injected executor.

## Determinism rules (grep-verified)
- `Date.now()` actual call: ONLY in `infrastructure/system-runtime-clock.ts`
  (all other mentions are in JSDoc comments).
- `Math.random()` actual call: NOWHERE (only mentioned in JSDoc comments).
- No module-level mutable state (no top-level `let`/`var`); all mutable state
  is instance-scoped inside classes/factories.

## tsc result
- `bunx tsc --noEmit 2>&1 | grep "kernel/runtime"` → empty (exit 1 = no matches).
- `bunx tsc --noEmit 2>&1 | grep -v "skills/" | head` → empty.
- Full `bunx tsc --noEmit` exits 0.

## Imports
- All cross-module imports use `@kernel/*` aliases (shared-kernel, events,
  observability, config). Internal imports are relative.
- `domain/` has TYPE-ONLY imports from `@kernel/events` (`EventInput`),
  `@kernel/observability` (`ObservabilityBundle`), `@kernel/config`
  (`ConfigRegistry`) — mandated by the task spec, erased at runtime.
- No imports from `@kernel/identity`, `@kernel/organizations`, `@kernel/projections`,
  `@kernel/policy`, `@kernel/scheduling`, or `@kernel/extension`.

## Foundation untouched
No files modified outside `kernel/runtime/` (worklog append is the only external write).
