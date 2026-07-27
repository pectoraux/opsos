# Task 4-d — scheduling module (agent: scheduling-module)

## Outcome
Built the kernel **scheduling** foundation module — the temporal-allocation
foundation. Per ADR-0008, Milestone 1 ships scheduling TYPES and a `Scheduler`
PORT ONLY — NO dispatch/routing algorithm. Concrete algorithms are
protocol-specific and installed later via the extension system. A
`NoopScheduler` placeholder ships so the kernel compiles and runs end-to-end.

12 files under `/home/z/my-project/kernel/scheduling/`. tsc `--noEmit` passes
with ZERO errors in `kernel/scheduling` and ZERO errors outside `skills/`.

## Files produced
```
kernel/scheduling/
├── domain/
│   ├── schedule.ts              Re-export canonicals + pure helpers
│   │                            (createScheduleWindow, createScheduleSlot,
│   │                             slotsOverlap, isWithin)
│   ├── recurrence.ts            expandRecurrence(rule, window) + MAX_EXPANSION
│   ├── route.ts                 Re-export Route/RouteStatus + RoutePlan
│   ├── schedule-policy.ts       SchedulePolicy + validateSchedule (pure)
│   ├── scheduler.ts             Scheduler PORT + ScheduleRequest + ScheduleResult
│   └── index.ts                 barrel
├── application/
│   ├── plan-schedule.ts         planSchedule(scheduler, request, now) — thin delegation
│   └── index.ts                 barrel
├── infrastructure/
│   ├── noop-scheduler.ts        NoopScheduler (id="noop") — ADR-0008 placeholder
│   └── index.ts                 barrel
├── interfaces/
│   └── index.ts                 public barrel (re-exports domain + application + infrastructure)
└── index.ts                     root entry → ./interfaces
```

## Public surface exported from `@kernel/scheduling`
- **Schedule types:** `Schedule`, `ScheduleSlot`, `ScheduleWindow`,
  `RecurrenceRule`, `ScheduleStatus` (canonical re-exports from shared-kernel).
- **Schedule helpers (pure):** `createScheduleWindow`, `createScheduleSlot`,
  `slotsOverlap`, `isWithin`.
- **Recurrence:** `expandRecurrence` (pure), `MAX_EXPANSION`.
- **Route:** `Route`, `RouteStatus` (canonical re-exports), `RoutePlan`.
- **Policy:** `SchedulePolicy`, `validateSchedule` (pure).
- **Scheduler PORT:** `Scheduler`, `ScheduleRequest`, `ScheduleResult`.
- **Application:** `planSchedule` (delegating use-case).
- **Adapter:** `NoopScheduler` (placeholder per ADR-0008 — `id = "noop"`).

## Key decisions
1. **Domain layer imports ONLY `@kernel/shared-kernel`.** The docs list
   `@kernel/events` and `@kernel/runtime` as allowed dependencies, but the
   module deliberately needs neither at the type level — `now` is sourced by
   the caller from `ExecutionContext.clock.now()` and passed as an argument,
   so the domain layer stays decoupled and inward-only.
2. **`createScheduleSlot` derives a deterministic id** from
   `${scheduleId}#${start}#${end}` via `asId<"ScheduleSlotId">`. Pure — no
   counter, no randomness. Same input → same id, safe inside the deterministic
   core.
3. **`expandRecurrence` uses a fixed-ms `FREQ_MS` table.** Month/year are
   30/365-day approximations — documented as deliberate simplicity (protocol-
   supplied schedulers may install richer expanders later). `byDays` filter
   uses `new Date(epochMs).getUTCDay()` which is a pure ms→Date conversion
   (NOT wall-clock — `Date.now()` is forbidden). Overflow → `[]`.
4. **`validateSchedule` returns `Result<readonly string[], KernelError>`** —
   `ok(violations)` with empty = valid, `err(ValidationError)` only for
   malformed policy (e.g. negative bounds, `minSlotDurationMs >
   maxSlotDurationMs`). Generic `constraints[]` deliberately NOT evaluated
   (protocol-specific — installed later via the extension system).
5. **`Scheduler.plan` accepts `now: number`** (not `ExecutionContext`) —
   keeps the domain layer decoupled from runtime; the caller sources `now`
   from `ExecutionContext.clock.now()`.
6. **`NoopScheduler` produces deterministic schedule id**
   `noop#${correlationId}#${now}` so the same request at the same clock tick
   yields the same id (no counter, no randomness).
7. **`infrastructure/` IS part of the public barrel** (mirrors
   `runtime`/`events`/`projections`) because `NoopScheduler` is the default
   scheduler consumers wire up out of the box.
8. **NoopScheduler returns:** empty schedule (`status: "draft"`, no slots),
   no routes, ALL demands listed in `unmet`, single warning
   `"noop-scheduler: no algorithm installed"`, `producedAt = now`,
   `plannerId = "noop"`.

## Determinism rules (grep-verified)
- `Date.now()` / `Math.random()` / `setTimeout` / `setInterval`: NOWHERE in
  actual code — only JSDoc comment mentions (forbidden-pattern documentation).
- No module-level mutable state (no top-level `let`/`var`); all mutable state
  would be instance-scoped (none in this module — everything is pure).
- Value imports: `asId`, `ok`, `err`, `ValidationError` from `@kernel/shared-kernel`.
  All other imports are type-only.

## tsc result
- `bunx tsc --noEmit 2>&1 | grep "kernel/scheduling"` → EMPTY (exit 1 = no matches).
- `bunx tsc --noEmit 2>&1 | grep -v "skills/" | head` → EMPTY.
- Full `bunx tsc --noEmit` exits 0.

## Imports
- All cross-module imports use `@kernel/*` aliases (only `@kernel/shared-kernel`).
  Internal imports are relative (single-level `../` or `./`).
- `domain/` has TYPE-ONLY imports from `@kernel/shared-kernel` plus value
  imports of `asId` (schedule.ts), `ok`/`err`/`ValidationError`
  (schedule-policy.ts). Erased at runtime except those value imports.
- `application/` has type-only imports from `../domain/scheduler`.
- `infrastructure/` has value imports of `asId` from shared-kernel + type-only
  imports from `../domain/scheduler`.
- NO imports from `@kernel/identity`, `@kernel/organizations`, `@kernel/projections`,
  `@kernel/policy`, `@kernel/extension`, `@kernel/observability`.

## Composition example (for downstream consumers)
```ts
import {
  NoopScheduler,
  planSchedule,
  createScheduleWindow,
  createScheduleSlot,
  expandRecurrence,
  validateSchedule,
  type SchedulePolicy,
  type ScheduleRequest,
} from "@kernel/scheduling";
import { asId } from "@kernel/shared-kernel";

const policy: SchedulePolicy = {
  id: "default",
  name: "Default",
  maxSlotsPerResource: 4,
  minSlotDurationMs: 15 * 60_000,
  maxSlotDurationMs: 8 * 3_600_000,
  requiredGapMs: 5 * 60_000,
  allowedWindows: [],
  excludedWindows: [],
  constraints: [],
};

const request: ScheduleRequest = {
  tenantId: asId<"TenantId">("t-1"),
  demands: [],
  resources: [],
  policy,
  window: createScheduleWindow(0, 86_400_000, "UTC"),
  correlationId: "op-1",
};

// `now` sourced from ExecutionContext.clock.now() by the caller
const result = await planSchedule(new NoopScheduler(), request, /* now */ 0);
// result.schedule.slots === [] ; result.unmet === [] ; result.warnings === ["noop-scheduler: no algorithm installed"]

// Pure helpers (no I/O, no Date.now()):
const slot = createScheduleSlot(asId<"ScheduleId">("s-1"), 0, 60_000, { max: 1, unit: "tasks" });
const occurrences = expandRecurrence({ freq: "hour", interval: 1, count: 24 },
  createScheduleWindow(0, 86_400_000, "UTC"));
const verdict = validateSchedule(policy, { ...result.schedule, slots: [slot] });
// verdict.ok === true ; verdict.value.length === number of violations (0 = valid)
```

## Foundation untouched
No files modified outside `kernel/scheduling/` (worklog append is the only
external write).
