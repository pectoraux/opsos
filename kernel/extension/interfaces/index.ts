/**
 * @kernel/extension/interfaces — public surface barrel.
 *
 * Re-exports the domain, application, and infrastructure layers so consumers
 * can `import { ... } from "@kernel/extension"` and get the full contract.
 *
 * Layering (inward-only dependency direction) is preserved: infrastructure
 * depends on application/domain; application depends on domain; domain
 * depends only on `@kernel/shared-kernel` (canonical primitive types +
 * `Result`/`KernelError`/`ValidationError`). NO imports from any other
 * kernel module — per ADR-0006 the registry references primitive TYPES via
 * `@kernel/shared-kernel` only, so protocols can be installed without
 * dragging in the whole kernel.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `register()` (the host's `registerX` methods + the registry's `add` /
 * `registerPlugin` / `unregisterPlugin`) is the ONLY mutation surface and
 * runs at BOOT / PROTOCOL-INSTALL time — OUTSIDE the deterministic core.
 * The deterministic core (RuntimeExecutor) only READS the registry.
 *
 * Public surface (re-exported through `@kernel/extension`):
 *   - Manifest:        `ExtensionId`, `ExtensionDependency`,
 *                       `ExtensionManifest`, `validateManifest`
 *   - Registrations:   the 9 contracts + `ExtensionRegistration` union +
 *                       `ExtensionRegistrationKind`
 *   - Plugin:          `Plugin`, `ExtensionContext`
 *   - Host PORT:       `ExtensionHost`
 *   - Registry PORT:   `ExtensionRegistry`, `MutableExtensionRegistry`
 *   - Application:     `installPlugin`, `listByProtocol`, `listProviding`
 *   - Adapters:        `InMemoryExtensionRegistry`, `DefaultExtensionHost`
 *
 * Per ADR-0006, Milestone 1 ships the host + registry + contracts ONLY —
 * NO protocol plugins.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
