/**
 * @kernel/extension/application/list-extensions — pure query helpers over the
 * registry.
 *
 * `listByProtocol(registry, protocolId)`: returns plugins whose manifest
 * declares the given `protocolId`.
 * `listProviding(registry, capabilityType)`: returns plugins whose manifest
 * `provides` list includes the given `capabilityType`.
 *
 * Pure queries: no I/O, no `Date.now()`, no `Math.random()`. They read the
 * registry's `listPlugins()` and filter — the result is a fresh array each
 * call (callers may mutate it freely).
 *
 * These helpers do NOT read the per-kind stores (`capabilities()`,
 * `intentTypes()`, ...) — they operate on the plugin list because the
 * manifest is the source of truth for "which protocol does this extension
 * belong to" and "which capability types does this extension provide".
 */
import type { ExtensionRegistry } from "../domain/extension-registry";
import type { Plugin } from "../domain/plugin";

/**
 * List plugins whose manifest declares `protocolId`.
 *
 * @param registry   the registry to query
 * @param protocolId the protocol id to match (e.g. `"cleaning"`)
 * @returns a fresh array of matching plugins, in insertion order
 */
export function listByProtocol(
  registry: ExtensionRegistry,
  protocolId: string
): readonly Plugin[] {
  return registry
    .listPlugins()
    .filter((p) => p.manifest.protocolId === protocolId);
}

/**
 * List plugins whose manifest `provides` list includes `capabilityType`.
 *
 * @param registry        the registry to query
 * @param capabilityType  the capability / intent type to match
 * @returns a fresh array of matching plugins, in insertion order
 */
export function listProviding(
  registry: ExtensionRegistry,
  capabilityType: string
): readonly Plugin[] {
  return registry
    .listPlugins()
    .filter((p) => p.manifest.provides.includes(capabilityType));
}
