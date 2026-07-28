/**
 * @kernel/application-runtime/features — feature flag resolver.
 *
 * Per application, per organization, per environment. Resolves the final
 * boolean state of a flag by layering: manifest default → org overrides →
 * environment overrides.
 */

export interface FeatureFlagOverrides {
  readonly organization?: Readonly<Record<string, boolean>>;
  readonly environment?: Readonly<Record<string, boolean>>;
}

export interface ResolvedFeatureFlags {
  readonly values: Readonly<Record<string, boolean>>;
}

export function resolveFeatureFlags(
  declarations: ReadonlyArray<{ key: string; default: boolean }>,
  overrides: FeatureFlagOverrides = {}
): ResolvedFeatureFlags {
  const values: Record<string, boolean> = {};
  for (const f of declarations) {
    values[f.key] = f.default;
  }
  if (overrides.organization) {
    for (const [k, v] of Object.entries(overrides.organization)) {
      if (k in values) values[k] = v;
    }
  }
  if (overrides.environment) {
    for (const [k, v] of Object.entries(overrides.environment)) {
      if (k in values) values[k] = v;
    }
  }
  return { values };
}

export function isFeatureEnabled(
  resolved: ResolvedFeatureFlags,
  key: string
): boolean {
  return resolved.values[key] ?? false;
}
