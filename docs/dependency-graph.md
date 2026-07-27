# OpsOS — Dependency Graph

Strict, layered, acyclic. Dependencies point **inward** and **downward** only.

```
                         ┌──────────────────┐
                         │  shared-kernel   │   ← canonical primitives, branded IDs,
                         │  (the bedrock)   │     Result/Option, value objects,
                         └────────┬─────────┘     RuntimeClock/RandomSource PORTS
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
     ┌──────▼──────┐      ┌───────▼────────┐    ┌───────▼────────┐
     │   events    │      │ observability  │    │     config     │
     │ (envelopes, │      │ (tracer/meter/ │    │ (sources,      │
     │  stores)    │      │  logger/audit) │    │  registry)     │
     └──────┬──────┘      └───────┬────────┘    └───────┬────────┘
            │                     │                     │
            └──────────┬──────────┴──────────┬──────────┘
                       │                     │
                ┌──────▼─────────────────────▼──────┐
                │             runtime               │   ← ExecutionContext,
                │  (clock impls, executor, graph)   │     Executor, State
                └──────┬────────────────────────────┘
                       │
   ┌───────────────────┼─────────────────────────┐
   │                   │                         │
┌──▼─────────┐  ┌──────▼───────┐  ┌──────────────▼──────────┐
│  identity  │  │ projections  │  │ policy / scheduling     │
│ (User,     │  │ (engine,     │  │ (PolicyEngine,          │
│  Principal)│  │  read models)│  │  Scheduler port)        │
└──────┬─────┘  └──────────────┘  └─────────────────────────┘
       │
┌──────▼──────────┐
│  organizations  │
│ (Org, Tenant)   │
└─────────────────┘

                       ┌──────────────┐
                       │  extension   │   ← host + registry; references
                       │  (protocol   │     primitive TYPES via shared-kernel
                       │   host)      │     only (decoupled from modules)
                       └──────┬───────┘
                              │
                         shared-kernel
```

## Allowed edges (exhaustive)

| From → | May import |
|---|---|
| `shared-kernel` | (none) |
| `events` | `shared-kernel` |
| `observability` | `shared-kernel` |
| `config` | `shared-kernel` |
| `runtime` | `shared-kernel`, `events`, `observability`, `config` |
| `identity` | `shared-kernel`, `events`, `observability` |
| `organizations` | `shared-kernel`, `events`, `observability`, `identity` |
| `projections` | `shared-kernel`, `events`, `observability`, `runtime` |
| `policy` | `shared-kernel`, `events`, `observability`, `runtime` |
| `scheduling` | `shared-kernel`, `events`, `runtime` |
| `extension` | `shared-kernel` only (registry holds primitive types, not module impls) |

## Forbidden edges (examples)

- `events` → `runtime` ❌  (events is lower than runtime)
- `identity` → `organizations` ❌  (identity holds only opaque `OrganizationId`)
- `domain/` → `application/` ❌  (inward-only within a module)
- `domain/` or `application/` → `infrastructure/` ❌
- any module → `Date.now()` / `Math.random()` in `domain/` or `application/` ❌
- `extension` → any module's `application/`/`infrastructure/` ❌ (only primitive types)

## Layering rule within every module

```
interfaces/   (public barrel — re-exports domain + application contracts)
     │
application/  (command/query handlers, services — depends on domain + ports)
     │
domain/       (aggregates, entities, value objects, ports — depends on shared-kernel only)
     │
infrastructure/ (port impls — depends on application/domain + external libs; NOT in public barrel)
```

`infrastructure/` is intentionally **outside** the public barrel so consumers
depend on ports, not adapters (dependency inversion).
