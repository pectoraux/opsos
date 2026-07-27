/**
 * @kernel/application-runtime/ui — UI extension resolver.
 *
 * Filters the manifest's UI extension bindings by `enabled`. The host
 * application layer resolves `componentRef` to a real component at render
 * time — the kernel does NOT link React.
 */

import type { UIExtensionBinding } from "../applications/application-manifest";

export interface ResolvedUIExtension extends UIExtensionBinding {}

export function resolveUIExtensions(
  bindings: readonly UIExtensionBinding[]
): readonly ResolvedUIExtension[] {
  return bindings.filter((b) => b.enabled);
}

export function resolveUIExtensionsByMountPoint(
  bindings: readonly UIExtensionBinding[],
  mountPoint: string
): readonly ResolvedUIExtension[] {
  return resolveUIExtensions(bindings).filter((b) => b.mountPoint === mountPoint);
}
