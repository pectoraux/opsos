# Task 4-b — projections module (agent: projections-module)

## Outcome
Built the kernel **projections** module — the CQRS read-model engine. 13 files
under `/home/z/my-project/kernel/projections/`. tsc `--noEmit` passes with
ZERO errors in `kernel/projections` and ZERO errors outside `skills/`.

## Files produced
```
kernel/projections/
├── domain/
│   ├── projection-definition.ts    ProjectionDefinition<TState> + ProjectionApplyContext
│   ├── projection-store.ts         ReadModel, ProjectionQuery, ProjectionStore PORT
│   ├── projection-engine.ts        ProjectionEngine PORT
│   ├── projection-rebuilder.ts     ProjectionRebuilder PORT + ProjectionRebuildResult
│   └── index.ts                    barrel
├── application/
│   ├── project-event.ts            PURE applyEvent(def, state, event, ctx): TState
│   ├── rebuild-projection.ts       createProjectionRebuilder({ store, definitions }): ProjectionRebuilder
│   └── index.ts                    barrel
├── infrastructure/
│   ├── in-memory-projection-store.ts   InMemoryProjectionStore (Map-based)
│   ├── in-memory-projection-engine.ts  InMemoryProjectionEngine + InMemoryProjectionEngineDeps
│   └── index.ts                        barrel
├── interfaces/
│   └── index.ts                    public barrel (re-exports domain + application + infrastructure)
└── index.ts                        root entry → ./interfaces
```

## Public surface exported from `@kernel/projections`
- **Definition:** `ProjectionDefinition<TState>`, `ProjectionApplyContext`.
- **Store:** `ReadModel<TState>`, `ProjectionQuery`, `ProjectionStore` (port).
- **Engine:** `ProjectionEngine` (port).
- **Rebuilder:** `ProjectionRebuilder` (port), `ProjectionRebuildResult`.
- **Application:** `applyEvent` (pure), `ProjectionRebuilderDeps`,
  `createProjectionRebuilder`.
- **Adapters:** `InMemoryProjectionStore`, `InMemoryProjectionEngine`,
  `InMemoryProjectionEngineDeps`.

## Key decisions
1. **`ProjectionApplyContext` carries ONLY `correlationId` + optional `tenantId`** —
   deliberately NO clock/random. Projections are pure functions of events; all
   time comes from `event.timestamp` (clock-sourced at emit time). Same events
   → same read models, regardless of replay wall-clock.
2. **`ReadModel.lastEventVersion`** = per-stream `event.version` of the last
   applied event (NOT a global position — `EventEnvelope` carries no global
   position field, only per-stream `version`). **`updatedAt`** = `event.timestamp`.
   Both sourced from the envelope, never from `Date.now()`.
3. **`applyEvent`** is the SINGLE sanctioned entry point for the per-event
   transition — both the live engine and the rebuilder use it, so the
   `sourceEventTypes` filtering rule is defined exactly once. Returns `state`
   referentially unchanged when the event type doesn't match (no spurious copy).
4. **The rebuilder is an APPLICATION-LAYER factory** (`createProjectionRebuilder`)
   implementing the domain `ProjectionRebuilder` port — it composes a
   `ProjectionStore` + a `definitions()` provider (typically `engine.list()`).
   No separate in-memory rebuilder adapter is needed; infrastructure provides
   only the store + engine.
5. **`rebuild(projectionId)`** clears the projection's read models first
   (`store.clear`), then replays `eventStore.readAll()` from position 0.
   `rebuildAll` iterates all registered definitions and calls the per-projection
   rebuild for each.
6. **`InMemoryProjectionEngine.start(eventStore)`** derives a per-event
   `ProjectionApplyContext` from `event.metadata` (correlationId required,
   tenantId optional — branded via `asId<"TenantId">`). Per-event errors from
   `apply` are caught+swallowed so one faulty projection can't kill the live
   subscription; `handle` (direct call) propagates errors.
7. **`InMemoryProjectionStore.query`** returns a fresh array (defensive copy of
   the list, not the model objects — models are immutable by contract). `clear`
   snapshots keys via `Array.from(...)` to avoid mutation-during-iteration.
8. **`register<TState>`** widens to `ProjectionDefinition` (i.e.
   `ProjectionDefinition<unknown>`) for uniform Map storage — safe under TS's
   interface-method bivariance + covariant readonly `initialState`.
9. **`@kernel/runtime` is NOT imported.** `ProjectionApplyContext` is a minimal
   structural subset of `ExecutionContext` (correlationId + tenantId) defined
   locally; an `ExecutionContext` satisfies it structurally, so callers pass a
   derived ctx without projections needing the runtime import. The docs list
   runtime as an allowed dep, but the module only needs the ctx shape.

## Determinism rules (grep-verified)
- `Date.now()` / `new Date()` / `Math.random()` / `setTimeout` / `setInterval`:
  NOWHERE in actual code — only JSDoc comment mentions.
- No module-level mutable state (no top-level `let`/`var`); all mutable state
  is instance-scoped inside `InMemoryProjectionStore` / `InMemoryProjectionEngine`.
- The only value imports are `asId` (shared-kernel branded-id boundary) and
  `applyEvent` (the pure use-case). All other imports are type-only.

## tsc result
- `bunx tsc --noEmit 2>&1 | grep "kernel/projections"` → empty (exit 1 = no matches).
- `bunx tsc --noEmit 2>&1 | grep -v "skills/" | head` → empty.
- Full `bunx tsc --noEmit` exits 0.

## Imports
- All cross-module imports use `@kernel/*` aliases (shared-kernel, events).
  Internal imports are relative (single-level `../`).
- `domain/` has TYPE-ONLY imports from `@kernel/shared-kernel` (`ProjectionId`,
  `TenantId`) and `@kernel/events` (`EventEnvelope`, `EventStore`,
  `Subscription`) — erased at runtime.
- `application/` has type-only imports from `@kernel/events` (`EventStore`),
  `@kernel/shared-kernel` (`ProjectionId`), and relative domain types; one
  value import of `applyEvent` from `./project-event`.
- `infrastructure/` imports `asId` (value) from shared-kernel + type-only
  imports from shared-kernel/events + relative domain/application.
- No imports from `@kernel/identity`, `@kernel/organizations`, `@kernel/policy`,
  `@kernel/scheduling`, `@kernel/extension`. (Only a JSDoc mention of
  `@kernel/identity` in interfaces/index.ts for cross-module consistency note.)

## Composition example (for the read-only inspector / downstream consumers)
```ts
import {
  InMemoryProjectionStore,
  InMemoryProjectionEngine,
  createProjectionRebuilder,
  type ProjectionDefinition,
} from "@kernel/projections";
import { asId } from "@kernel/shared-kernel";

const def: ProjectionDefinition<MyState> = {
  id: asId<"ProjectionId">("user-count"),
  name: "User Count",
  sourceEventTypes: ["UserRegistered", "UserDisabled"],
  initialState: { count: 0 },
  apply: (s, e) => /* pure */ ({ ...s, count: s.count + (e.eventType === "UserRegistered" ? 1 : -1) }),
  // keyFor omitted → singleton "all"
};

const store = new InMemoryProjectionStore();
const engine = new InMemoryProjectionEngine({ store });
engine.register(def);
const liveSub = engine.start(eventStore);          // live stream
const rebuilder = createProjectionRebuilder({ store, definitions: () => engine.list() });
await rebuilder.rebuildAll(eventStore, { correlationId: "catch-up" });  // replay from scratch
const [rm] = await store.query({ projectionId: def.id });
```

## Foundation untouched
No files modified outside `kernel/projections/` (worklog append is the only
external write).
