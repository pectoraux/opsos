/**
 * @kernel/extension/domain — barrel.
 *
 * Pure domain layer of the extension bounded context: manifest + validation,
 * the 9 registration contracts (+ `ExtensionRegistration` discriminated
 * union), the `Plugin` interface + `ExtensionContext`, the `ExtensionHost`
 * PORT, and the `ExtensionRegistry` / `MutableExtensionRegistry` PORTs.
 *
 * Depends ONLY on `@kernel/shared-kernel` (canonical primitive types +
 * `Result`/`KernelError`/`ValidationError`). No I/O, no `Date.now()`, no
 * `Math.random()`.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `register()` (the host's `registerX` methods + the registry's `add` /
 * `registerPlugin`) is the ONLY mutation surface and runs at BOOT /
 * PROTOCOL-INSTALL time — OUTSIDE the deterministic core. The deterministic
 * core (RuntimeExecutor) only READS the registry.
 *
 * Public surface (re-exported through `@kernel/extension`):
 *   - Manifest:       `ExtensionId`, `ExtensionDependency`,
 *                      `ExtensionManifest`, `validateManifest`
 *   - Registrations:  the 9 contracts + `ExtensionRegistration` union +
 *                      `ExtensionRegistrationKind`
 *   - Plugin:         `Plugin`, `ExtensionContext`
 *   - Host PORT:      `ExtensionHost`
 *   - Registry PORT:  `ExtensionRegistry`, `MutableExtensionRegistry`
 */
export * from "./manifest";
export * from "./registrations";
export * from "./plugin";
export * from "./extension-host";
export * from "./extension-registry";
