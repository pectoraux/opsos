/**
 * @kernel/composition/domain/package-diagnostics — `PackageDiagnostic` and
 * `CompositionDiagnostics`.
 *
 * Every stage of the composition pipeline (resolve → validate → link → bundle
 * → sign → package) emits `PackageDiagnostic` records rather than throwing.
 * The pipeline accumulates them into a `CompositionDiagnostics` collection
 * and decides at the end whether the build succeeded (`hasFatal` is false).
 *
 * Severities (in order of escalating severity):
 *   `info`   — informational (e.g. "skipping optional dep").
 *   `warn`   — warning (e.g. "package has no signature").
 *   `error`  — error (e.g. "missing required dependency") — blocks packaging.
 *   `fatal`  — unrecoverable (e.g. "cycle in dependency graph") — aborts
 *              immediately.
 *
 * Pure domain layer.
 */

/**
 * Severity of a `PackageDiagnostic`. `error` and `fatal` block successful
 * packaging; `warn` and `info` are surfaced but do not block.
 */
export type DiagnosticSeverity = "info" | "warn" | "error" | "fatal";

/** The composition stage that produced a diagnostic. */
export type CompositionStage =
  | "resolve"
  | "validate"
  | "link"
  | "bundle"
  | "sign"
  | "package";

/**
 * A single diagnostic from a composition stage.
 *
 *   `severity`  — info / warn / error / fatal.
 *   `code`      — machine-readable code (e.g. `"DEPENDENCY_MISSING"`).
 *   `message`   — human-readable message.
 *   `stage`     — which pipeline stage produced this.
 *   `field`     — optional dotted field path the diagnostic refers to.
 */
export interface PackageDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly stage: CompositionStage;
  readonly field?: string;
}

/** Construct a `PackageDiagnostic`. Pure helper. */
export function diagnostic(
  stage: CompositionStage,
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  field?: string
): PackageDiagnostic {
  return { stage, severity, code, message, field };
}

/**
 * A collection of `PackageDiagnostic`s with convenience helpers.
 *
 *   `all`        — every diagnostic in emission order.
 *   `hasFatal`   — true iff any diagnostic is `fatal`-severity.
 *   `hasErrors`  — true iff any diagnostic is `error` OR `fatal`-severity.
 */
export interface CompositionDiagnostics {
  readonly all: readonly PackageDiagnostic[];
  readonly hasFatal: boolean;
  readonly hasErrors: boolean;
}

/** Build a `CompositionDiagnostics` view over a flat list. */
export function compositionDiagnostics(
  diags: readonly PackageDiagnostic[]
): CompositionDiagnostics {
  const hasFatal = diags.some((d) => d.severity === "fatal");
  const hasErrors = diags.some(
    (d) => d.severity === "error" || d.severity === "fatal"
  );
  return { all: diags, hasFatal, hasErrors };
}

/** True iff a list contains any error-or-fatal diagnostic. */
export function hasErrors(diags: readonly PackageDiagnostic[]): boolean {
  return diags.some(
    (d) => d.severity === "error" || d.severity === "fatal"
  );
}

/** Filter a list to only error-or-fatal diagnostics. */
export function errorsOnly(
  diags: readonly PackageDiagnostic[]
): readonly PackageDiagnostic[] {
  return diags.filter(
    (d) => d.severity === "error" || d.severity === "fatal"
  );
}
