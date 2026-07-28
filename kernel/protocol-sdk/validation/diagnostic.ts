/**
 * @kernel/protocol-sdk/validation/diagnostic — SDK-wide diagnostics.
 *
 * Every validation surface (manifest, registrations, dependency graph,
 * lifecycle) produces `SdkDiagnostic` records rather than throwing. The caller
 * decides whether `error`-severity diagnostics block installation.
 */

export type DiagnosticSeverity = "info" | "warn" | "error";

export interface SdkDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly source: string;
  readonly field?: string;
}

export function diagnostic(
  source: string,
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  field?: string
): SdkDiagnostic {
  return { source, severity, code, message, field };
}

/** True if any diagnostic is `error`-severity. */
export function hasErrors(diags: readonly SdkDiagnostic[]): boolean {
  return diags.some((d) => d.severity === "error");
}

/** Filter to only error-severity diagnostics. */
export function errorsOnly(diags: readonly SdkDiagnostic[]): readonly SdkDiagnostic[] {
  return diags.filter((d) => d.severity === "error");
}
