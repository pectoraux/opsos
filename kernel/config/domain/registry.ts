/**
 * @kernel/config/domain/registry — ConfigRegistry merges sources by precedence.
 */

import type {
  ConfigKey,
  ConfigValue,
  ConfigSource,
  ConfigWatcher,
} from "./config-source";

export interface ConfigRegistry {
  readonly sources: readonly ConfigSource[];
  get<T extends ConfigValue>(key: ConfigKey): T | undefined;
  getOrDefault<T extends ConfigValue>(key: ConfigKey, fallback: T): T;
  watch(key: ConfigKey, watcher: ConfigWatcher): () => void;
}

export function createConfigRegistry(sources: readonly ConfigSource[]): ConfigRegistry {
  const ordered = [...sources].sort((a, b) => b.precedence - a.precedence);
  return {
    sources: ordered,
    get<T extends ConfigValue>(key: ConfigKey): T | undefined {
      for (const s of ordered) {
        const v = s.get<T>(key);
        if (v !== undefined) return v;
      }
      return undefined;
    },
    getOrDefault<T extends ConfigValue>(key: ConfigKey, fallback: T): T {
      for (const s of ordered) {
        const v = s.get<T>(key);
        if (v !== undefined) return v;
      }
      return fallback;
    },
    watch(key: ConfigKey, watcher: ConfigWatcher): () => void {
      const unsubs = ordered.map((s) => s.watch(key, watcher));
      return () => unsubs.forEach((u) => u());
    },
  };
}
