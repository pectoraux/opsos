/**
 * @kernel/application-runtime/navigation — navigation resolver.
 *
 * Filters the manifest's navigation entries by feature flags + permissions.
 * The host application layer renders the resolved tree.
 */

import type { NavigationEntry } from "../applications/application-manifest";
import type { ResolvedFeatureFlags } from "../features/feature-flag-resolver";

export interface ResolvedNavigationEntry extends NavigationEntry {
  readonly children?: readonly ResolvedNavigationEntry[];
}

export interface NavigationResolutionContext {
  readonly featureFlags: ResolvedFeatureFlags;
  readonly hasPermission?: (permission: string) => boolean;
}

export function resolveNavigation(
  entries: readonly NavigationEntry[],
  ctx: NavigationResolutionContext
): readonly ResolvedNavigationEntry[] {
  const filterEntry = (e: NavigationEntry): ResolvedNavigationEntry | null => {
    if (e.featureFlag && !ctx.featureFlags.values[e.featureFlag]) {
      return null;
    }
    if (e.requiredPermission && !(ctx.hasPermission?.(e.requiredPermission) ?? true)) {
      return null;
    }
    const children = e.children
      ?.map(filterEntry)
      .filter((c): c is ResolvedNavigationEntry => c !== null);
    return { ...e, children };
  };

  return entries
    .map(filterEntry)
    .filter((e): e is ResolvedNavigationEntry => e !== null)
    .sort((a, b) => a.order - b.order);
}
