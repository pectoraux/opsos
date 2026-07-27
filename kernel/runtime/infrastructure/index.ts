/**
 * @kernel/runtime/infrastructure — barrel + in-memory adapters.
 *
 * Reference implementations of the runtime ports:
 *   - `SystemRuntimeClock`  (the ONLY `Date.now()` site in the kernel)
 *   - `FixedRuntimeClock`   (deterministic, frozen — for replay/tests/sim)
 *   - `SeededRandomSource`  (mulberry32-backed; deterministic for a seed)
 *   - `DeterministicRuntimeExecutor` (topological, deterministic executor)
 *   - `createOperationRegistry()` (in-memory `OperationRegistry` factory)
 *
 * These ARE part of the runtime public surface (unlike most modules, the
 * runtime ships canonical clock/random/executor impls that every consumer
 * uses), so they are re-exported through `interfaces/`.
 */

import type {
  OperationRegistry,
  OperationRef,
  OperationHandler,
} from "../domain/operation";

export { SystemRuntimeClock } from "./system-runtime-clock";
export { FixedRuntimeClock } from "./fixed-runtime-clock";
export { SeededRandomSource } from "./seeded-random-source";
export {
  DeterministicRuntimeExecutor,
} from "./deterministic-runtime-executor";
export type { DeterministicRuntimeExecutorDeps } from "./deterministic-runtime-executor";

const refKey = (ref: OperationRef): string => `${ref.name}@${ref.version}`;

/**
 * Create an in-memory `OperationRegistry`. Instance-scoped (no module-level
 * mutable state — preserves the determinism rule). Registering a duplicate
 * `(name, version)` ref throws — there is no silent overwrite.
 */
export function createOperationRegistry(): OperationRegistry {
  const handlers = new Map<string, OperationHandler>();
  const refs: OperationRef[] = [];

  return {
    register(ref: OperationRef, handler: OperationHandler): void {
      const key = refKey(ref);
      if (handlers.has(key)) {
        throw new Error(
          `OperationRegistry: operation '${key}' is already registered`
        );
      }
      handlers.set(key, handler);
      refs.push(ref);
    },
    resolve(ref: OperationRef): OperationHandler | undefined {
      return handlers.get(refKey(ref));
    },
    list(): readonly OperationRef[] {
      return refs.slice();
    },
  };
}
