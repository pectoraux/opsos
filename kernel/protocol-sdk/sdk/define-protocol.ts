/**
 * @kernel/protocol-sdk/sdk/define-protocol — the `defineProtocol()` DSL.
 *
 * Strongly-typed builder for a protocol. Returns a `Protocol` object the SDK
 * runtime installs via the LifecycleManager.
 *
 *   export default defineProtocol({
 *     manifest: { id: "opsos.protocol.cleaning", version: "1.0.0", ... },
 *   }).register((host) => {
 *     host.registerCapability(defineCapability({ ... }))
 *         .registerIntentType(defineIntent({ ... }))
 *         .registerPolicy(definePolicy({ ... }));
 *   });
 */

import type { ProtocolManifest } from "../manifest/protocol-manifest";
import type { ProtocolHost } from "../registry/protocol-host";
import type { ProtocolContributions } from "../registry/protocol-registry";

/** A protocol's register callback — pushes contributions through the host. */
export type ProtocolRegisterFn = (host: ProtocolHost) => void | Promise<void>;

/** A protocol definition: manifest + register callback. */
export interface Protocol {
  readonly manifest: ProtocolManifest;
  register: ProtocolRegisterFn;
}

/** Input to `defineProtocol()`. */
export interface DefineProtocolInput {
  readonly manifest: ProtocolManifest;
}

/**
 * Build a protocol. Chain `.register(fn)` to attach the registration callback.
 * The returned object is what `export default` from a protocol module.
 */
export function defineProtocol(input: DefineProtocolInput): ProtocolBuilder {
  return new ProtocolBuilderImpl(input.manifest);
}

export interface ProtocolBuilder {
  /** Attach the registration callback. Returns the frozen Protocol. */
  register(fn: ProtocolRegisterFn): Protocol;
}

class ProtocolBuilderImpl implements ProtocolBuilder {
  private _register: ProtocolRegisterFn | null = null;
  constructor(private readonly _manifest: ProtocolManifest) {}

  register(fn: ProtocolRegisterFn): Protocol {
    this._register = fn;
    return {
      manifest: this._manifest,
      register: this._register ?? (() => {}),
    };
  }
}
