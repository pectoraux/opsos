/**
 * @kernel/protocol-sdk/lifecycle/default-lifecycle-manager — reference
 * ProtocolLifecycleManager.
 *
 * Coordinates: manifest validation → dependency resolution → contribution
 * collection + application, with full audit trail. The ONLY component that
 * transitions protocol state. Per the spec, protocols cannot change their own
 * lifecycle.
 *
 * The manager is given a `registerProtocol(manifest, host)` callback (provided
 * by the caller, typically the SDK's `defineProtocol` runtime) so it stays
 * decoupled from the concrete Protocol type. On `enable`, it collects the
 * protocol's contributions through that callback and applies them to the
 * master registry atomically. On `disable`/`uninstall`/`upgrade`, it removes
 * them.
 */

import type { ProtocolManifest } from "../manifest/protocol-manifest";
import { KERNEL_VERSION } from "../manifest/protocol-manifest";
import { validateProtocolManifest } from "../manifest/manifest-validation";
import { resolveDependencyOrder, nodeOf } from "../validation/dependency-resolver";
import { hasErrors } from "../validation/diagnostic";
import type { SdkDiagnostic } from "../validation/diagnostic";
import {
  canTransition,
  type ProtocolLifecycleState,
  type LifecycleEvent,
} from "./lifecycle-state";
import {
  type TrackedProtocol,
  type LifecycleTransitionResult,
  type ProtocolLifecycleManager,
} from "./lifecycle-manager";
import type { ProtocolRegistry } from "../registry/protocol-registry";
import type { ProtocolContributions } from "../registry/protocol-registry";
import { ProtocolHost } from "../registry/protocol-host";

export interface DefaultLifecycleManagerDeps {
  readonly registry: ProtocolRegistry;
  /** Injected clock for audit timestamps (deterministic). */
  readonly clock: { now(): number };
  /**
   * Called by enable() to run the protocol's `register(host)` callback and
   * collect contributions. Provided by the caller (the SDK runtime) so the
   * manager stays decoupled from the Protocol definition type.
   */
  readonly registerProtocol: (
    manifest: ProtocolManifest,
    host: ProtocolHost
  ) => void | Promise<void>;
}

interface InternalProtocol extends TrackedProtocol {
  contributions?: ProtocolContributions;
}

export class DefaultLifecycleManager implements ProtocolLifecycleManager {
  private readonly protocols = new Map<string, InternalProtocol>();
  private readonly eventLog: LifecycleEvent[] = [];
  private readonly deps: DefaultLifecycleManagerDeps;

  constructor(deps: DefaultLifecycleManagerDeps) {
    this.deps = deps;
  }

  private record(
    protocolId: string,
    from: ProtocolLifecycleState,
    to: ProtocolLifecycleState,
    reason?: string
  ): void {
    this.eventLog.push({
      protocolId,
      from,
      to,
      at: this.deps.clock.now(),
      reason,
    });
  }

  private fail(
    protocolId: string,
    from: ProtocolLifecycleState,
    to: ProtocolLifecycleState,
    message: string,
    code: string,
    diagnostics: readonly SdkDiagnostic[] = [],
    reason?: string
  ): LifecycleTransitionResult {
    return {
      ok: false,
      protocolId,
      from,
      to,
      diagnostics: [
        ...diagnostics,
        { severity: "error", code, message, source: "lifecycle-manager" },
      ],
      reason,
    };
  }

  discover(manifest: ProtocolManifest): LifecycleTransitionResult {
    if (this.protocols.has(manifest.id)) {
      return this.fail(
        manifest.id,
        this.protocols.get(manifest.id)!.state,
        "discovered",
        `Protocol '${manifest.id}' is already tracked`,
        "PROTOCOL_ALREADY_TRACKED"
      );
    }
    const now = this.deps.clock.now();
    this.protocols.set(manifest.id, {
      manifest,
      state: "discovered",
      lastTransitionAt: now,
    });
    this.record(manifest.id, "uninstalled", "discovered", "discovered");
    return {
      ok: true,
      protocolId: manifest.id,
      from: "uninstalled",
      to: "discovered",
      diagnostics: [],
    };
  }

  validate(protocolId: string): LifecycleTransitionResult {
    const tracked = this.protocols.get(protocolId);
    if (!tracked) {
      return this.fail(protocolId, "uninstalled", "validated", `Protocol '${protocolId}' is not tracked`, "PROTOCOL_NOT_FOUND");
    }
    const diags = validateProtocolManifest(tracked.manifest, KERNEL_VERSION);
    if (hasErrors(diags)) {
      return { ok: false, protocolId, from: tracked.state, to: "validated", diagnostics: diags, reason: "manifest validation failed" };
    }
    return this.transition(protocolId, "validated", diags);
  }

  install(protocolId: string): LifecycleTransitionResult {
    const tracked = this.protocols.get(protocolId);
    if (!tracked) {
      return this.fail(protocolId, "uninstalled", "installed", `Protocol '${protocolId}' is not tracked`, "PROTOCOL_NOT_FOUND");
    }
    const diags = validateProtocolManifest(tracked.manifest, KERNEL_VERSION);
    const resolution = resolveDependencyOrder([nodeOf(tracked.manifest)]);
    const allDiags = [...diags, ...resolution.diagnostics];
    if (hasErrors(allDiags)) {
      return { ok: false, protocolId, from: tracked.state, to: "installed", diagnostics: allDiags, reason: "validation/dependency check failed" };
    }
    const result = this.transition(protocolId, "installed", allDiags);
    if (result.ok) {
      const installed = this.protocols.get(protocolId)!;
      this.protocols.set(protocolId, { ...installed, installedAt: this.deps.clock.now() });
    }
    return result;
  }

  enable(protocolId: string): LifecycleTransitionResult {
    const tracked = this.protocols.get(protocolId);
    if (!tracked) {
      return this.fail(protocolId, "uninstalled", "enabled", `Protocol '${protocolId}' is not tracked`, "PROTOCOL_NOT_FOUND");
    }
    // If first enable (or after upgrade with no contributions), collect + apply.
    if (!tracked.contributions) {
      const host = new ProtocolHost(protocolId);
      try {
        // Synchronous call — async-agnostic (the SDK's registerProtocol may be async,
        // but the in-memory manager treats it as sync for simplicity; a future adapter
        // can make enable() async).
        this.deps.registerProtocol(tracked.manifest, host);
      } catch (e) {
        return this.fail(protocolId, tracked.state, "enabled", `register() threw: ${e instanceof Error ? e.message : String(e)}`, "REGISTER_FAILED");
      }
      const contribs = host.build();
      try {
        this.deps.registry.applyContributions(contribs);
      } catch (e) {
        return this.fail(protocolId, tracked.state, "enabled", `applyContributions threw: ${e instanceof Error ? e.message : String(e)}`, "APPLY_FAILED");
      }
      this.protocols.set(protocolId, { ...tracked, contributions: contribs });
    }
    return this.transition(protocolId, "enabled");
  }

  disable(protocolId: string): LifecycleTransitionResult {
    const tracked = this.protocols.get(protocolId);
    if (!tracked) {
      return this.fail(protocolId, "uninstalled", "disabled", `Protocol '${protocolId}' is not tracked`, "PROTOCOL_NOT_FOUND");
    }
    this.deps.registry.removeContributions(protocolId);
    return this.transition(protocolId, "disabled");
  }

  upgrade(protocolId: string, newManifest: ProtocolManifest): LifecycleTransitionResult {
    const tracked = this.protocols.get(protocolId);
    if (!tracked) {
      return this.fail(protocolId, "uninstalled", "upgraded", `Protocol '${protocolId}' is not tracked`, "PROTOCOL_NOT_FOUND");
    }
    this.deps.registry.removeContributions(protocolId);
    const updated: InternalProtocol = {
      ...tracked,
      manifest: newManifest,
      state: "upgraded",
      lastTransitionAt: this.deps.clock.now(),
      contributions: undefined,
    };
    this.protocols.set(protocolId, updated);
    this.record(protocolId, tracked.state, "upgraded", `upgraded to ${newManifest.version}`);
    return { ok: true, protocolId, from: tracked.state, to: "upgraded", diagnostics: [] };
  }

  uninstall(protocolId: string): LifecycleTransitionResult {
    const tracked = this.protocols.get(protocolId);
    if (tracked) {
      this.deps.registry.removeContributions(protocolId);
    }
    const from = tracked?.state ?? "uninstalled";
    if (!tracked) {
      return this.fail(protocolId, "uninstalled", "uninstalled", `Protocol '${protocolId}' is not tracked`, "PROTOCOL_NOT_FOUND");
    }
    this.protocols.delete(protocolId);
    this.record(protocolId, from, "uninstalled", "uninstalled");
    return { ok: true, protocolId, from, to: "uninstalled", diagnostics: [] };
  }

  getState(protocolId: string): ProtocolLifecycleState | undefined {
    return this.protocols.get(protocolId)?.state;
  }

  getProtocol(protocolId: string): TrackedProtocol | undefined {
    return this.protocols.get(protocolId);
  }

  list(): readonly TrackedProtocol[] {
    return Array.from(this.protocols.values());
  }

  events(): readonly LifecycleEvent[] {
    return this.eventLog.slice();
  }

  private transition(
    protocolId: string,
    to: ProtocolLifecycleState,
    diagnostics: readonly SdkDiagnostic[] = [],
    reason?: string
  ): LifecycleTransitionResult {
    const tracked = this.protocols.get(protocolId);
    if (!tracked) {
      return this.fail(protocolId, "uninstalled", to, `Protocol '${protocolId}' is not tracked`, "PROTOCOL_NOT_FOUND", diagnostics);
    }
    const from = tracked.state;
    if (!canTransition(from, to)) {
      return this.fail(protocolId, from, to, `Cannot transition from '${from}' to '${to}'`, "ILLEGAL_TRANSITION", diagnostics);
    }
    this.protocols.set(protocolId, { ...tracked, state: to, lastTransitionAt: this.deps.clock.now() });
    this.record(protocolId, from, to, reason);
    return { ok: true, protocolId, from, to, diagnostics, reason };
  }
}
