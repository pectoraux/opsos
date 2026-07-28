/**
 * @kernel/application-runtime/configuration — layered configuration resolver.
 *
 * Layers (lowest → highest precedence):
 *   protocol defaults → organization overrides → application overrides → environment
 *
 * Typed via the manifest's `ConfigurationSchema`. The resolver validates that
 * every `required` field has a value after merging, and produces diagnostics
 * for missing/unknown keys.
 */

import type {
  ConfigurationSchema,
  ConfigurationOverride,
} from "../applications/application-manifest";
import type { SdkDiagnostic } from "@kernel/protocol-sdk";
import { diagnostic } from "@kernel/protocol-sdk";

export interface ResolvedConfiguration {
  readonly values: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly SdkDiagnostic[];
}

const LAYER_PRECEDENCE: Readonly<Record<string, number>> = {
  protocol: 10,
  organization: 20,
  application: 30,
  environment: 40,
};

export function resolveConfiguration(
  schema: ConfigurationSchema,
  overrides: readonly ConfigurationOverride[]
): ResolvedConfiguration {
  const ordered = [...overrides].sort(
    (a, b) => (LAYER_PRECEDENCE[a.layer] ?? 0) - (LAYER_PRECEDENCE[b.layer] ?? 0)
  );

  // Start with schema defaults.
  const values: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.default !== undefined) {
      values[f.key] = f.default;
    }
  }

  // Apply overrides in precedence order.
  for (const layer of ordered) {
    for (const [key, value] of Object.entries(layer.values)) {
      values[key] = value;
    }
  }

  // Validate: required fields present, no unknown keys.
  const diags: SdkDiagnostic[] = [];
  const knownKeys = new Set(schema.fields.map((f) => f.key));
  for (const f of schema.fields) {
    if (f.required && !(f.key in values)) {
      diags.push(diagnostic("configuration", "error", "CONFIG_REQUIRED_MISSING", `Required configuration field '${f.key}' has no value`));
    }
  }
  for (const key of Object.keys(values)) {
    if (!knownKeys.has(key)) {
      diags.push(diagnostic("configuration", "warn", "CONFIG_UNKNOWN_KEY", `Configuration key '${key}' is not declared in the schema`));
    }
  }

  return { values, diagnostics: diags };
}
