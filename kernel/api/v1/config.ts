/**
 * @kernel/api/v1 — CONFIG public surface (FROZEN).
 */
export type {
  ConfigKey,
  ConfigValue,
  ConfigWatcher,
  ConfigSchema,
  ConfigFieldSpec,
  ConfigSource,
  SecretHandle,
  Secrets,
  ConfigRegistry,
} from "@kernel/config";

export {
  createConfigRegistry,
  InMemoryConfigSource,
  EnvConfigSource,
  InMemorySecrets,
} from "@kernel/config";
