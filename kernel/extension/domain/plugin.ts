/**
 * @kernel/extension/domain/plugin — the Plugin interface + ExtensionContext.
 *
 * A `Plugin` is the unit of installation: it carries a manifest and a
 * `register(host)` method that pushes registration descriptors into the host.
 * Optional lifecycle hooks `onActivate` / `onDeactivate` are declared for
 * future milestones; Milestone 1 only REGISTERS plugins — it does not
 * activate them (per ADR-0006).
 *
 * `ExtensionContext` is the shape passed to lifecycle hooks: the manifest,
 * the host (for late registration), and a `log` sink. The `log` sink is a
 * port — the actual logging implementation is provided by the caller
 * (infrastructure); the domain layer never calls `console.log` directly.
 *
 * Pure domain layer: type-only. No I/O, no `Date.now()`, no `Math.random()`.
 */
import type { ExtensionHost } from "./extension-host";
import type { ExtensionManifest } from "./manifest";

/**
 * Context handed to a plugin's lifecycle hooks (`onActivate` / `onDeactivate`).
 *
 * `log` is a port — the actual logging implementation is provided by the
 * caller (infrastructure). The domain layer never calls `console.log`
 * directly; it only declares the shape.
 */
export interface ExtensionContext {
  readonly manifest: ExtensionManifest;
  readonly host: ExtensionHost;
  readonly log: (
    message: string,
    attrs?: Readonly<Record<string, unknown>>
  ) => void;
}

/**
 * A protocol plugin. The unit of installation on the OpsOS kernel.
 *
 * `register(host)` is called ONCE at install time (outside the deterministic
 * core — see ADR-0006). It MUST be side-effect-free with respect to the
 * deterministic core: it only pushes immutable descriptors into the host.
 * Lifecycle hooks `onActivate` / `onDeactivate` are declared but NOT invoked
 * in Milestone 1.
 *
 * `register` MAY be async (e.g. a remote plugin that fetches descriptors);
 * the `installPlugin` use-case `await`s it.
 */
export interface Plugin {
  readonly manifest: ExtensionManifest;
  register(host: ExtensionHost): void | Promise<void>;
  /** Optional: invoked when the plugin is activated (future milestone). */
  onActivate?(ctx: ExtensionContext): void | Promise<void>;
  /** Optional: invoked when the plugin is deactivated (future milestone). */
  onDeactivate?(ctx: ExtensionContext): void | Promise<void>;
}
