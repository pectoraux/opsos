/**
 * @kernel/compiler/domain/diagnostic — non-fatal compiler diagnostics.
 *
 * Diagnostics accumulate across stages. They never abort compilation (use
 * `AbortCompilationError` for that); they carry warnings/info/notices that the
 * caller (and the inspector) may surface.
 */

export type DiagnosticSeverity = "info" | "warn" | "error";

export interface CompilerDiagnostic {
  readonly stage: string;
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly at?: number;
}

export function diagnostic(
  stage: string,
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  at?: number
): CompilerDiagnostic {
  return { stage, severity, code, message, at };
}
