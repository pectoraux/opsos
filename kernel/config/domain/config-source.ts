/**
 * @kernel/config/domain — configuration ports.
 *
 * `ConfigSource` is a typed, watchable config provider. `ConfigRegistry` merges
 * multiple sources with declared precedence. `Secrets` is an opaque handle for
 * secret values that must never be logged.
 */

import type { UnknownRecord } from "@kernel/shared-kernel";

export type ConfigKey = string;
export type ConfigValue = string | number | boolean | null | UnknownRecord | readonly unknown[];

export interface ConfigWatcher {
  (value: ConfigValue | undefined): void;
}

export interface ConfigSchema {
  readonly namespace: string;
  readonly version: number;
  readonly fields: Readonly<Record<string, ConfigFieldSpec>>;
}

export interface ConfigFieldSpec {
  readonly type: "string" | "number" | "boolean" | "object" | "array";
  readonly required?: boolean;
  readonly default?: ConfigValue;
  readonly secret?: boolean;
  readonly description?: string;
}

export interface ConfigSource {
  readonly name: string;
  readonly precedence: number; // higher wins
  get<T extends ConfigValue>(key: ConfigKey): T | undefined;
  has(key: ConfigKey): boolean;
  watch(key: ConfigKey, watcher: ConfigWatcher): () => void;
  keys(): readonly ConfigKey[];
}

export interface SecretHandle {
  readonly ref: string;
  /** Reveal the secret value. MUST NOT be logged. */
  reveal(): string | undefined;
}

export interface Secrets {
  get(name: string): SecretHandle | undefined;
  list(): readonly string[];
}
