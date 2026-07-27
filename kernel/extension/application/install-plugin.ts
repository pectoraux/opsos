/**
 * @kernel/extension/application/install-plugin — install a plugin into the
 * registry via the host.
 *
 * Flow:
 *   1. validate the manifest structurally (id non-empty, version present,
 *      name non-empty) — pure
 *   2. reject if a plugin with the same manifest id is already registered
 *      — pure given the registry's `getPlugin`
 *   3. call `plugin.register(host)` — the plugin pushes descriptors via the
 *      host's `registerX` methods (may be async)
 *   4. call `registry.registerPlugin(plugin)` — stores the plugin itself
 *
 * On validation failure (steps 1–2) returns `err(ValidationError)` WITHOUT
 * invoking `plugin.register`. On failure inside `plugin.register` or
 * `registry.registerPlugin`, the thrown error is caught and returned as
 * `err(KernelError)`.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * This use-case runs at BOOT / PROTOCOL-INSTALL time — OUTSIDE the
 * deterministic core. It is NOT invoked from inside `RuntimeExecutor`. The
 * deterministic core only READS the registry.
 *
 * Milestone 1 does NOT invoke the plugin's `onActivate` lifecycle hook —
 * plugins are REGISTERED only (per ADR-0006). The hook is declared on
 * `Plugin` for future milestones.
 *
 * Pure w.r.t. `(registry, host, plugin)`: no `Date.now()`, no `Math.random()`,
 * no I/O of its own. `plugin.register` may itself be async (e.g. a remote
 * plugin) — the use-case `await`s it but performs no I/O of its own.
 */
import {
  KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";
import type { ExtensionHost } from "../domain/extension-host";
import type { ExtensionRegistry } from "../domain/extension-registry";
import type { Plugin } from "../domain/plugin";
import { validateManifest } from "../domain/manifest";

/**
 * Install `plugin` into `registry` via `host`.
 *
 * @param registry the registry to install into
 * @param host     the host the plugin pushes descriptors through
 * @param plugin   the plugin to install
 * @returns `ok(undefined)` on success; `err(ValidationError)` on manifest
 *          validation failure or duplicate id; `err(KernelError)` if
 *          `plugin.register` or `registry.registerPlugin` throws.
 */
export async function installPlugin(
  registry: ExtensionRegistry,
  host: ExtensionHost,
  plugin: Plugin
): Promise<Result<void, KernelError>> {
  // 1. Structural manifest validation (pure).
  const validation = validateManifest(plugin.manifest);
  if (!validation.ok) {
    return validation;
  }

  // 2. Reject duplicate id BEFORE invoking plugin.register — otherwise a
  //    re-install would push duplicate descriptors into the registry before
  //    failing. The registry's `registerPlugin` enforces uniqueness again
  //    (defense in depth) for callers that bypass this use-case.
  if (registry.getPlugin(plugin.manifest.id) !== undefined) {
    return err(
      new ValidationError(
        `extension '${plugin.manifest.id}' is already registered`,
        [{ field: "manifest.id", reason: "duplicate" }]
      )
    );
  }

  // 3. Let the plugin push its descriptors via the host. The host's
  //    `registerX` methods validate + push into the registry's per-kind
  //    stores. Errors thrown by the plugin or the host are caught and
  //    returned as `err(KernelError)`.
  try {
    await plugin.register(host);
  } catch (e) {
    return err(toKernelError(e, "plugin.register"));
  }

  // 4. Store the plugin itself. `registry.registerPlugin` re-validates
  //    manifest-id uniqueness (defense in depth) — for an in-memory
  //    single-threaded registry the check at step 2 guarantees this succeeds,
  //    but a concurrent / remote registry implementation might race.
  try {
    const result = registry.registerPlugin(plugin);
    if (!result.ok) {
      return result;
    }
    return ok(undefined);
  } catch (e) {
    return err(toKernelError(e, "registry.registerPlugin"));
  }
}

/**
 * Coerce a thrown value into a `KernelError`.
 *
 * `KernelError` instances (including `ValidationError`) pass through
 * unchanged. Plain `Error`s are wrapped in a `ValidationError` (the closest
 * fit for "the plugin misbehaved during registration"). Anything else is
 * wrapped generically.
 *
 * Internal to this module — not part of the public surface.
 */
function toKernelError(e: unknown, where: string): KernelError {
  if (e instanceof KernelError) return e;
  if (e instanceof Error) {
    return new ValidationError(`${where}: ${e.message}`);
  }
  return new ValidationError(`${where}: unknown failure`);
}
