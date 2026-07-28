/**
 * @kernel/ecosystem-conformance/domain/conformance-result — the result of
 * running the ecosystem conformance suite against a package.
 */

import type { ConformanceCheckId } from "./conformance-check";

export type CheckStatus = "pass" | "fail" | "skip" | "warn";

export interface CheckResult {
  readonly checkId: ConformanceCheckId;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface EcosystemConformanceResult {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly passed: boolean;
  readonly requiredChecksPassed: number;
  readonly requiredChecksTotal: number;
  readonly optionalChecksPassed: number;
  readonly optionalChecksTotal: number;
  readonly results: readonly CheckResult[];
  readonly summary: string;
}

export function isConformancePass(result: EcosystemConformanceResult): boolean {
  return result.passed;
}
