/**
 * @kernel/application-runtime/lifecycle/default-lifecycle-manager — reference
 * ApplicationLifecycleManager.
 *
 * Coordinates: manifest validation → registry insertion → state transitions,
 * with full audit trail. The ONLY component that transitions application state.
 */

import type { ApplicationManifest } from "../applications/application-manifest";
import type { Application, ApplicationSummary, ApplicationVersionEntry } from "../applications/application";
import { validateApplicationManifest } from "../applications/application-validation";
import { hasErrors } from "@kernel/protocol-sdk";
import type { SdkDiagnostic } from "@kernel/protocol-sdk";
import {
  canTransition,
  type ApplicationLifecycleState,
  type ApplicationLifecycleEvent,
} from "./lifecycle-state";
import type {
  ApplicationTransitionResult,
  ApplicationLifecycleManager,
} from "./lifecycle-manager";
import type { ApplicationRegistry } from "../applications/application-registry";

export interface DefaultApplicationLifecycleManagerDeps {
  readonly registry: ApplicationRegistry;
  readonly clock: { now(): number };
  /**
   * Returns the installed protocol version for `protocolId`, or undefined if
   * the protocol is not installed. Used for compatibility checks.
   */
  readonly getInstalledProtocolVersion?: (protocolId: string) => string | undefined;
}

interface InternalApplication extends Application {}

export class DefaultApplicationLifecycleManager implements ApplicationLifecycleManager {
  private readonly eventLog: ApplicationLifecycleEvent[] = [];
  private readonly deps: DefaultApplicationLifecycleManagerDeps;

  constructor(deps: DefaultApplicationLifecycleManagerDeps) {
    this.deps = deps;
  }

  private record(
    applicationId: string,
    from: ApplicationLifecycleState,
    to: ApplicationLifecycleState,
    reason?: string
  ): void {
    this.eventLog.push({ applicationId, from, to, at: this.deps.clock.now(), reason });
  }

  private fail(
    applicationId: string,
    from: ApplicationLifecycleState,
    to: ApplicationLifecycleState,
    code: string,
    message: string,
    diagnostics: readonly SdkDiagnostic[] = [],
    reason?: string
  ): ApplicationTransitionResult {
    return {
      ok: false,
      applicationId,
      from,
      to,
      diagnostics: [
        ...diagnostics,
        { severity: "error", code, message, source: "application-lifecycle" },
      ],
      reason,
    };
  }

  create(manifest: ApplicationManifest): ApplicationTransitionResult {
    if (this.deps.registry.get(manifest.id)) {
      return this.fail(manifest.id, "draft", "draft", "APP_ALREADY_EXISTS", `Application '${manifest.id}' already exists`);
    }
    const installedProto = this.deps.getInstalledProtocolVersion?.(manifest.protocolId);
    const diags = validateApplicationManifest(manifest, installedProto);
    if (hasErrors(diags)) {
      return { ok: false, applicationId: manifest.id, from: "draft", to: "draft", diagnostics: diags, reason: "manifest validation failed" };
    }
    const now = this.deps.clock.now();
    const app: InternalApplication = {
      manifest,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      versionHistory: [{ version: manifest.version, protocolVersion: manifest.protocolVersion, installedAt: now, reason: "created" }],
    };
    this.deps.registry.put(app);
    this.record(manifest.id, "removed", "draft", "created");
    return { ok: true, applicationId: manifest.id, from: "removed", to: "draft", diagnostics: diags };
  }

  private transition(
    applicationId: string,
    to: ApplicationLifecycleState,
    diagnostics: readonly SdkDiagnostic[] = [],
    reason?: string
  ): ApplicationTransitionResult {
    const app = this.deps.registry.get(applicationId);
    if (!app) {
      return this.fail(applicationId, "removed", to, "APP_NOT_FOUND", `Application '${applicationId}' not found`, diagnostics);
    }
    const from = app.status;
    if (!canTransition(from, to)) {
      return this.fail(applicationId, from, to, "ILLEGAL_TRANSITION", `Cannot transition from '${from}' to '${to}'`, diagnostics);
    }
    const updated: InternalApplication = { ...app, status: to, updatedAt: this.deps.clock.now() };
    this.deps.registry.put(updated);
    this.record(applicationId, from, to, reason);
    return { ok: true, applicationId, from, to, diagnostics, reason };
  }

  install(applicationId: string): ApplicationTransitionResult {
    return this.transition(applicationId, "installed");
  }

  configure(applicationId: string): ApplicationTransitionResult {
    return this.transition(applicationId, "configured");
  }

  activate(applicationId: string): ApplicationTransitionResult {
    const result = this.transition(applicationId, "active");
    if (result.ok) {
      const app = this.deps.registry.get(applicationId)!;
      this.deps.registry.put({ ...app, activatedAt: this.deps.clock.now() });
    }
    return result;
  }

  suspend(applicationId: string): ApplicationTransitionResult {
    const result = this.transition(applicationId, "suspended");
    if (result.ok) {
      const app = this.deps.registry.get(applicationId)!;
      this.deps.registry.put({ ...app, suspendedAt: this.deps.clock.now() });
    }
    return result;
  }

  archive(applicationId: string): ApplicationTransitionResult {
    return this.transition(applicationId, "archived");
  }

  remove(applicationId: string): ApplicationTransitionResult {
    const app = this.deps.registry.get(applicationId);
    const result = this.transition(applicationId, "removed");
    if (result.ok) {
      this.deps.registry.delete(applicationId);
    }
    return result;
  }

  upgrade(applicationId: string, newManifest: ApplicationManifest): ApplicationTransitionResult {
    const app = this.deps.registry.get(applicationId);
    if (!app) {
      return this.fail(applicationId, "removed", "active", "APP_NOT_FOUND", `Application '${applicationId}' not found`);
    }
    const installedProto = this.deps.getInstalledProtocolVersion?.(newManifest.protocolId);
    const diags = validateApplicationManifest(newManifest, installedProto);
    if (hasErrors(diags)) {
      return { ok: false, applicationId, from: app.status, to: app.status, diagnostics: diags, reason: "new manifest validation failed" };
    }
    const now = this.deps.clock.now();
    const versionEntry: ApplicationVersionEntry = {
      version: newManifest.version,
      protocolVersion: newManifest.protocolVersion,
      installedAt: now,
      reason: `upgraded from ${app.manifest.version}`,
    };
    const updated: InternalApplication = {
      ...app,
      manifest: newManifest,
      updatedAt: now,
      versionHistory: [...app.versionHistory, versionEntry],
    };
    this.deps.registry.put(updated);
    this.record(applicationId, app.status, app.status, `upgraded to ${newManifest.version}`);
    return { ok: true, applicationId, from: app.status, to: app.status, diagnostics: diags };
  }

  rollback(applicationId: string, toVersion: string): ApplicationTransitionResult {
    const app = this.deps.registry.get(applicationId);
    if (!app) {
      return this.fail(applicationId, "removed", "active", "APP_NOT_FOUND", `Application '${applicationId}' not found`);
    }
    const entry = app.versionHistory.find((v) => v.version === toVersion);
    if (!entry) {
      return this.fail(applicationId, app.status, app.status, "ROLLBACK_VERSION_NOT_FOUND", `Version '${toVersion}' not in history`);
    }
    const now = this.deps.clock.now();
    const updated: InternalApplication = {
      ...app,
      updatedAt: now,
      versionHistory: [...app.versionHistory, { version: toVersion, protocolVersion: entry.protocolVersion, installedAt: now, reason: `rolled back from ${app.manifest.version}` }],
    };
    this.deps.registry.put(updated);
    this.record(applicationId, app.status, app.status, `rolled back to ${toVersion}`);
    return { ok: true, applicationId, from: app.status, to: app.status, diagnostics: [] };
  }

  getApplication(applicationId: string): Application | undefined {
    return this.deps.registry.get(applicationId);
  }

  list(): readonly ApplicationSummary[] {
    return this.deps.registry.list().map(toSummary);
  }

  events(): readonly ApplicationLifecycleEvent[] {
    return this.eventLog.slice();
  }
}

function toSummary(app: Application): ApplicationSummary {
  const primaryDomain = app.manifest.routing.domains.find((d) => d.primary)?.domain;
  return {
    id: app.manifest.id,
    name: app.manifest.name,
    displayName: app.manifest.displayName,
    organizationId: app.manifest.organizationId,
    tenantId: app.manifest.tenantId,
    protocolId: app.manifest.protocolId,
    protocolVersion: app.manifest.protocolVersion,
    version: app.manifest.version,
    status: app.status,
    primaryDomain,
    featureFlagCount: app.manifest.featureFlags.length,
    navigationCount: app.manifest.navigation.length,
  };
}
