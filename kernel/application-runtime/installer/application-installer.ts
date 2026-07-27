/**
 * @kernel/application-runtime/installer/application-installer — orchestrates
 * the full install flow.
 *
 *   1. Validate the application manifest (incl. protocol compatibility).
 *   2. Create the application (lifecycle: draft).
 *   3. Install → Configure → Activate.
 *   4. On any failure, rollback (remove the partial application).
 *
 * The installer is a use-case orchestrator; it delegates to the lifecycle
 * manager + validation. It does NOT execute business logic.
 */

import type { ApplicationManifest } from "../applications/application-manifest";
import { validateApplicationManifest } from "../applications/application-validation";
import { hasErrors } from "@kernel/protocol-sdk";
import type { SdkDiagnostic } from "@kernel/protocol-sdk";
import type { ApplicationLifecycleManager } from "../lifecycle/lifecycle-manager";
import type { ApplicationTransitionResult } from "../lifecycle/lifecycle-manager";
import { checkCompatibility } from "../versioning/version-manager";

export interface ApplicationInstallerDeps {
  readonly lifecycle: ApplicationLifecycleManager;
  readonly getInstalledProtocolVersion: (protocolId: string) => string | undefined;
}

export interface ApplicationInstallResult {
  readonly ok: boolean;
  readonly applicationId: string;
  readonly diagnostics: readonly SdkDiagnostic[];
  readonly steps: readonly { readonly step: string; readonly ok: boolean; readonly reason?: string }[];
  readonly finalStatus?: string;
}

/**
 * Install an application end-to-end:
 *   validate → create → install → configure → activate.
 * On any step failure, rollback (remove the partial application).
 */
export async function installApplication(
  deps: ApplicationInstallerDeps,
  manifest: ApplicationManifest
): Promise<ApplicationInstallResult> {
  const steps: { step: string; ok: boolean; reason?: string }[] = [];
  const allDiags: SdkDiagnostic[] = [];

  // 1. Validate compatibility: the pinned protocol version must match an installed protocol.
  const installedProto = deps.getInstalledProtocolVersion(manifest.protocolId);
  if (!installedProto) {
    const msg = `Protocol '${manifest.protocolId}' is not installed`;
    steps.push({ step: "compatibility", ok: false, reason: msg });
    allDiags.push({ severity: "error", code: "PROTOCOL_NOT_INSTALLED", message: msg, source: "application-installer" });
    return { ok: false, applicationId: manifest.id, diagnostics: allDiags, steps };
  }
  const compat = checkCompatibility(manifest.protocolVersion, installedProto);
  if (!compat.compatible) {
    steps.push({ step: "compatibility", ok: false, reason: compat.reason });
    allDiags.push({ severity: "error", code: "INCOMPATIBLE_PROTOCOL", message: compat.reason ?? "incompatible", source: "application-installer" });
    return { ok: false, applicationId: manifest.id, diagnostics: allDiags, steps };
  }
  steps.push({ step: "compatibility", ok: true });

  // 2. Validate the manifest structurally.
  const manifestDiags = validateApplicationManifest(manifest, installedProto);
  allDiags.push(...manifestDiags);
  if (hasErrors(manifestDiags)) {
    steps.push({ step: "validate", ok: false, reason: "manifest validation failed" });
    return { ok: false, applicationId: manifest.id, diagnostics: allDiags, steps };
  }
  steps.push({ step: "validate", ok: true });

  // 3. Create (draft).
  const createResult = deps.lifecycle.create(manifest);
  steps.push({ step: "create", ok: createResult.ok, reason: createResult.reason });
  if (!createResult.ok) {
    allDiags.push(...createResult.diagnostics);
    return { ok: false, applicationId: manifest.id, diagnostics: allDiags, steps };
  }

  // Helper to rollback.
  const rollback = (reason: string) => {
    deps.lifecycle.remove(manifest.id);
    steps.push({ step: "rollback", ok: true, reason });
  };

  // 4. Install.
  const installResult = deps.lifecycle.install(manifest.id);
  steps.push({ step: "install", ok: installResult.ok, reason: installResult.reason });
  if (!installResult.ok) {
    allDiags.push(...installResult.diagnostics);
    rollback("install failed");
    return { ok: false, applicationId: manifest.id, diagnostics: allDiags, steps };
  }

  // 5. Configure.
  const configureResult = deps.lifecycle.configure(manifest.id);
  steps.push({ step: "configure", ok: configureResult.ok, reason: configureResult.reason });
  if (!configureResult.ok) {
    allDiags.push(...configureResult.diagnostics);
    rollback("configure failed");
    return { ok: false, applicationId: manifest.id, diagnostics: allDiags, steps };
  }

  // 6. Activate.
  const activateResult = deps.lifecycle.activate(manifest.id);
  steps.push({ step: "activate", ok: activateResult.ok, reason: activateResult.reason });
  if (!activateResult.ok) {
    allDiags.push(...activateResult.diagnostics);
    rollback("activate failed");
    return { ok: false, applicationId: manifest.id, diagnostics: allDiags, steps };
  }

  const finalApp = deps.lifecycle.getApplication(manifest.id);
  return {
    ok: true,
    applicationId: manifest.id,
    diagnostics: allDiags,
    steps,
    finalStatus: finalApp?.status,
  };
}
