/**
 * @kernel/ecosystem-conformance/application/validate-ecosystem — the use-case
 * that validates an ecosystem package and returns a conformance result.
 *
 * If the package fails any REQUIRED check, it is REJECTED. The result includes
 * a human-readable summary explaining what passed, what failed, and what was
 * skipped.
 */

import { CONFORMANCE_CHECKS } from "../domain/conformance-check";
import type { ConformanceCheck } from "../domain/conformance-check";
import type {
  EcosystemConformanceResult,
  CheckResult,
  CheckStatus,
} from "../domain/conformance-result";
import type {
  EcosystemConformanceEngine,
  EcosystemPackageSummary,
} from "../domain/ecosystem-conformance-engine";

export function validateEcosystem(
  engine: EcosystemConformanceEngine,
  pkg: EcosystemPackageSummary
): EcosystemConformanceResult {
  return engine.validate(pkg);
}

export class ValidateEcosystemUseCase {
  constructor(private readonly engine: EcosystemConformanceEngine) {}
  execute(pkg: EcosystemPackageSummary): EcosystemConformanceResult {
    return this.engine.validate(pkg);
  }
}
