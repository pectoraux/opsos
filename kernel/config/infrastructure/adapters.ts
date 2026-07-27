/**
 * @kernel/config/infrastructure — config adapters.
 *
 * - `InMemoryConfigSource`: mutable in-memory source (for tests/bootstrap).
 * - `EnvConfigSource`: read-only source backed by `process.env`-like record.
 * - `InMemorySecrets`: simple in-memory secret store.
 */

import type {
  ConfigKey,
  ConfigValue,
  ConfigSource,
  ConfigWatcher,
  Secrets,
  SecretHandle,
} from "../domain";

export class InMemoryConfigSource implements ConfigSource {
  readonly name: string;
  readonly precedence: number;
  private readonly values: Map<ConfigKey, ConfigValue> = new Map();
  private readonly watchers: Map<ConfigKey, Set<ConfigWatcher>> = new Map();

  constructor(name = "in-memory", precedence = 0) {
    this.name = name;
    this.precedence = precedence;
  }

  get<T extends ConfigValue>(key: ConfigKey): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  has(key: ConfigKey): boolean {
    return this.values.has(key);
  }

  watch(key: ConfigKey, watcher: ConfigWatcher): () => void {
    let set = this.watchers.get(key);
    if (!set) {
      set = new Set();
      this.watchers.set(key, set);
    }
    set.add(watcher);
    return () => set!.delete(watcher);
  }

  keys(): readonly ConfigKey[] {
    return [...this.values.keys()];
  }

  /** Mutation API — not part of the deterministic core (used at bootstrap). */
  set(key: ConfigKey, value: ConfigValue): void {
    this.values.set(key, value);
    this.watchers.get(key)?.forEach((w) => w(value));
  }

  delete(key: ConfigKey): void {
    this.values.delete(key);
    this.watchers.get(key)?.forEach((w) => w(undefined));
  }
}

export class EnvConfigSource implements ConfigSource {
  readonly name = "env";
  readonly precedence: number;
  constructor(
    private readonly env: Record<string, string | undefined>,
    precedence = 10
  ) {
    this.precedence = precedence;
  }

  get<T extends ConfigValue>(key: ConfigKey): T | undefined {
    const raw = this.env[key];
    if (raw === undefined) return undefined;
    // Best-effort coercion; callers requiring typed values should validate.
    if (raw === "true") return true as T;
    if (raw === "false") return false as T;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw) as T;
    return raw as T;
  }

  has(key: ConfigKey): boolean {
    return this.env[key] !== undefined;
  }

  watch(): () => void {
    return () => {}; // env is read-only
  }

  keys(): readonly ConfigKey[] {
    return Object.keys(this.env);
  }
}

export class InMemorySecrets implements Secrets {
  private readonly secrets: Map<string, string> = new Map();
  constructor(values: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(values)) this.secrets.set(k, v);
  }
  get(name: string): SecretHandle | undefined {
    if (!this.secrets.has(name)) return undefined;
    return {
      ref: `secret:${name}`,
      reveal: () => this.secrets.get(name),
    };
  }
  list(): readonly string[] {
    return [...this.secrets.keys()];
  }
}
