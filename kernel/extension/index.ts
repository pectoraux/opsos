/**
 * @kernel/extension — root entry. Re-exports the public interfaces barrel so
 * `import { ... } from "@kernel/extension"` resolves the full extension
 * contract (the protocol host: Plugin, ExtensionManifest, ExtensionHost,
 * ExtensionRegistry, the 9 registration contracts, in-memory registry +
 * default host).
 *
 * Per ADR-0006, Milestone 1 ships the host + registry + contracts ONLY — NO
 * protocol plugins.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `register()` is the ONLY mutation surface and runs at BOOT /
 * PROTOCOL-INSTALL time — OUTSIDE the deterministic core. The deterministic
 * core (RuntimeExecutor) only READS the registry.
 */
export * from "./interfaces";
