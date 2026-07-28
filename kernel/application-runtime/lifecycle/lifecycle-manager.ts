/**
 * @kernel/application-runtime/lifecycle/lifecycle-manager — owns application
 * lifecycle. The ONLY component that transitions an application's state.
 *
 * Coordinates with the ApplicationRegistry. Per the spec: "Kernel owns
 * lifecycle. Applications cannot change their own lifecycle."
 */

import type { ApplicationManifest } from "../applications/application-manifest";
import type { Application, ApplicationSummary } from "../applications/application";
import type { ApplicationLifecycleState, ApplicationLifecycleEvent } from "./lifecycle-state";
import { canTransition } from "./lifecycle-state";
import type { ApplicationRegistry } from "../applications/application-registry";
import type { SdkDiagnostic } from "@kernel/protocol-sdk";

export interface ApplicationTransitionResult {
  readonly ok: boolean;
  readonly applicationId: string;
  readonly from: ApplicationLifecycleState;
  readonly to: ApplicationLifecycleState;
  readonly diagnostics: readonly SdkDiagnostic[];
  readonly reason?: string;
}

export interface ApplicationLifecycleManager {
  create(manifest: ApplicationManifest): ApplicationTransitionResult;
  install(applicationId: string): ApplicationTransitionResult;
  configure(applicationId: string): ApplicationTransitionResult;
  activate(applicationId: string): ApplicationTransitionResult;
  suspend(applicationId: string): ApplicationTransitionResult;
  archive(applicationId: string): ApplicationTransitionResult;
  remove(applicationId: string): ApplicationTransitionResult;
  upgrade(applicationId: string, newManifest: ApplicationManifest): ApplicationTransitionResult;
  rollback(applicationId: string, toVersion: string): ApplicationTransitionResult;
  getApplication(applicationId: string): Application | undefined;
  list(): readonly ApplicationSummary[];
  events(): readonly ApplicationLifecycleEvent[];
}
