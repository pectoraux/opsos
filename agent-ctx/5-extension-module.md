# Task 5 — extension module (agent: extension-module)

## Outcome
Built the kernel **extension** module — the protocol host. Per ADR-0006,
Milestone 1 ships the host + registry + contracts ONLY — NO protocol plugins.
Protocols (cleaning, delivery, healthcare, etc.) are the *applications*
installed on the kernel; they register capabilities, intent types, workflow
stages, policies, rules, UI extensions, analytics, API routes, and
marketplace listings via the typed `ExtensionHost` registrar surface.

The module is **domain-independent** and **fully decoupled** — it imports
canonical primitive TYPES from `@kernel/shared-kernel` ONLY (per
dependency-graph.md: `extension ← shared-kernel only`). NO imports from
`@kernel/events`, `@kernel/runtime`, `@kernel/identity`, `@kernel/organizations`,
`@kernel/projections`, `@kernel/policy`, `@kernel/scheduling`,
`@kernel/observability`, `@kernel/config`.

14 files under `/home/z/my-project/kernel/extension/`. tsc `--noEmit` passes
with ZERO errors in `kernel/extension` and ZERO errors outside `skills/`.

## Files produced
```
kernel/extension/
├── domain/
│   ├── manifest.ts                   ExtensionId, ExtensionDependency,
│   │                                  ExtensionManifest, validateManifest (pure)
│   ├── registrations.ts              9 registration contracts + ExtensionRegistration
│   │                                  discriminated union (kind discriminator) +
│   │                                  ExtensionRegistrationKind
│   ├── plugin.ts                     Plugin interface + ExtensionContext
│   ├── extension-host.ts             ExtensionHost PORT (9 typed registrars)
│   ├── extension-registry.ts         ExtensionRegistry PORT + MutableExtensionRegistry
│   │                                  (internal add(reg) mutation surface)
│   └── index.ts                      barrel
├── application/
│   ├── install-plugin.ts             installPlugin(registry, host, plugin) use-case
│   │                                  (boot/protocol-install time — OUTSIDE RuntimeExecutor)
│   ├── list-extensions.ts            listByProtocol, listProviding (pure queries)
│   └── index.ts                      barrel
├── infrastructure/
│   ├── in-memory-extension-registry.ts   InMemoryExtensionRegistry [I]
│   │                                       (Map-based; enforces manifest-id uniqueness;
│   │                                        unregisterPlugin removes contributed regs)
│   ├── default-extension-host.ts         DefaultExtensionHost [I]
│   │                                       (validating push-proxy over the registry)
│   └── index.ts                          barrel
├── interfaces/
│   └── index.ts                      public barrel (domain + application + infrastructure)
└── index.ts                          root entry — `export * from "./interfaces"`
```

## Public surface from `@kernel/extension`
- **Manifest:** `ExtensionId`, `ExtensionDependency`, `ExtensionManifest`,
  `validateManifest`
- **Registrations:** the 9 contracts (`CapabilityRegistration`,
  `IntentTypeRegistration`, `WorkflowStageRegistration`,
  `PolicyRegistration`, `RuleRegistration`, `UIExtensionRegistration`,
  `AnalyticsRegistration`, `ApiRouteRegistration`,
  `MarketplaceExtensionRegistration`) + `ExtensionRegistration` discriminated
  union + `ExtensionRegistrationKind`
- **Plugin:** `Plugin`, `ExtensionContext`
- **Host PORT:** `ExtensionHost`
- **Registry PORT:** `ExtensionRegistry`, `MutableExtensionRegistry`
- **Application:** `installPlugin`, `listByProtocol`, `listProviding`
- **Adapters:** `InMemoryExtensionRegistry`, `DefaultExtensionHost`
- Canonical re-exports (transitively via `@kernel/shared-kernel`):
  `Capability`, `Policy`, `Rule`, `Constraint`, `SchemaRef`, `Result`,
  `KernelError`, `ValidationError`, `ok`, `err`

## Key decisions
- **ZERO cross-module imports** except `@kernel/shared-kernel`. The registry
  holds DESCRIPTORS (plain immutable data) referencing canonical primitive
  TYPES — it does NOT instantiate or execute protocol behavior. This is the
  cleanest possible seam per ADR-0006: a protocol can be installed without
  dragging in `@kernel/events`, `@kernel/runtime`, `@kernel/policy`, etc.
- `ExtensionId = string` (aliased, not branded) — extension ids are
  self-certifying strings chosen by the protocol author, not kernel-branded
  identifiers.
- The 9 registration contracts each carry a `kind` discriminator
  (kebab-case string literal — matches kernel convention: `RuleEffect` uses
  `"require-approval"`, `WorkflowStatus` uses `"draft"|...`) so they form a
  discriminated union `ExtensionRegistration`. The registry's `add(reg)`
  switches on `reg.kind` with exhaustive cases (TS exhaustiveness pattern:
  `const exhaustive: never = reg;` in the default branch — adding a new kind
  without handling it is a compile error).
- `MutableExtensionRegistry extends ExtensionRegistry` is the INTERNAL
  mutation surface (the `add(reg)` method) used by `ExtensionHost`
  implementations. It is a SEPARATE interface so the deterministic core
  (which only sees `ExtensionRegistry`) cannot mutate the registry — only
  the host (infrastructure) can.
- **LOUD ADR-0006 INVARIANT** (in extension-host.ts, extension-registry.ts,
  in-memory-extension-registry.ts, default-extension-host.ts,
  infrastructure/index.ts, interfaces/index.ts, index.ts):
  `register()` is the ONLY mutation surface and runs at BOOT /
  PROTOCOL-INSTALL time — OUTSIDE `RuntimeExecutor`. The deterministic core
  (intent → demand → task → plan) NEVER calls `registerX`/`add`/
  `registerPlugin`; it only READS the registry. Adding registrations at
  runtime inside a command handler is a DETERMINISM VIOLATION.
- `installPlugin` flow: (1) PURE manifest validation → (2) duplicate-id
  check BEFORE `plugin.register` (so a re-install doesn't push duplicate
  descriptors before failing) → (3) `await plugin.register(host)` (errors
  caught + returned as `err(KernelError)`) → (4) `registry.registerPlugin`
  (re-validates uniqueness — defense in depth). Milestone 1 does NOT invoke
  `onActivate` — plugins are REGISTERED only.
- `UIExtensionRegistration.componentRef` and `ApiRouteRegistration.handlerRef`
  are OPAQUE strings — NO React, NO HTTP server in the kernel. The host
  application resolves these refs to real components/handlers at
  render/server-boot time.
- `ExtensionContext.log` is a PORT — the actual logging implementation is
  provided by the caller (infrastructure); the domain layer never calls
  `console.log` directly, only declares the shape.
- `unregisterPlugin` removes the plugin AND its contributed registrations
  (via a `removeAll<T extends { extensionId: ExtensionId }>(arr, id)` helper
  that splices backward) so the registry does not leak descriptors after
  uninstall; idempotent.
- Per-kind lookups return FRESH arrays via `.slice()` so callers can mutate
  freely without affecting the registry's internal state. `all()`
  concatenates per-kind arrays in the canonical kind order.
- `DefaultExtensionHost`'s `registerX` methods do defensive `assertKind` +
  `assertExtensionId` validation (TS prevents kind mismatch at the type
  level, but a caller using `as any` would be caught). Errors throw
  `ValidationError` (a `KernelError`) — `installPlugin` catches and returns
  `err`.
- Per ADR-0006, NO protocol plugins ship in this milestone — only the host
  + registry + contracts. The `Plugin` interface and `ExtensionContext` are
  declared for future milestones; `onActivate`/`onDeactivate` are NOT
  invoked.

## Determinism
- ZERO `Date.now()`/`new Date()`/`Math.random()`/`setTimeout`/`setInterval`
  actual calls in `kernel/extension/` (only JSDoc mentions).
- ZERO module-level mutable state (no top-level `let`/`var`; all mutable
  state is instance-scoped inside `InMemoryExtensionRegistry`/
  `DefaultExtensionHost`; the per-kind arrays are `private readonly` fields
  mutated in place via `push`/`splice`).
- ZERO deep relative imports (`../../`) — all relative imports are
  single-level `../` within the module.
- The only cross-module value imports are `KernelError`, `Result` (type),
  `ValidationError`, `ok`, `err` from `@kernel/shared-kernel`. Canonical
  primitives (`Capability`, `Constraint`, `Policy`, `Rule`, `SchemaRef`) are
  imported type-only.

## Verification
- `cd /home/z/my-project && bunx tsc --noEmit 2>&1 | grep "kernel/extension"`
  → EMPTY
- `bunx tsc --noEmit 2>&1 | grep -v "skills/" | head` → EMPTY
- Full `bunx tsc --noEmit` exits 0
- `grep -rn "@kernel/(events|runtime|identity|organizations|projections|policy|scheduling|observability|config)" kernel/extension/` → ZERO matches
- `grep -rn "^import .* from ['\"](react|next|http|express|fastify|prisma)" kernel/extension/` → ZERO matches
- Every file starts with a JSDoc comment (verified via `head -1`)

## Foundation untouched
No files modified outside `kernel/extension/` except the worklog append +
this agent-ctx record.
