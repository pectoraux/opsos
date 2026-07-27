/**
 * @kernel/extension/infrastructure — barrel.
 *
 * Reference in-memory adapters for the extension module: the Map-based
 * `InMemoryExtensionRegistry` (implements `MutableExtensionRegistry`) and
 * the `DefaultExtensionHost` (a thin validating push-proxy over the
 * registry).
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no plugin sandboxing).
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * Both adapters' mutation methods (`add`, `registerPlugin`,
 * `unregisterPlugin` on the registry; `registerX` on the host) run at BOOT /
 * PROTOCOL-INSTALL time — OUTSIDE the deterministic core. The deterministic
 * core (RuntimeExecutor) only READS the registry via the query methods.
 */
export { InMemoryExtensionRegistry } from "./in-memory-extension-registry";
export { DefaultExtensionHost } from "./default-extension-host";
