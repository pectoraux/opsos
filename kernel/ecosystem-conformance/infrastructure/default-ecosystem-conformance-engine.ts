/**
 * @kernel/ecosystem-conformance/infrastructure/default-ecosystem-conformance-engine
 * — reference implementation.
 *
 * Evaluates each check against the package summary. Deterministic: same package
 * summary always produces the same result. No Date.now() / Math.random().
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

export class DefaultEcosystemConformanceEngine implements EcosystemConformanceEngine {
  validate(pkg: EcosystemPackageSummary): EcosystemConformanceResult {
    const results: CheckResult[] = CONFORMANCE_CHECKS.map((check) =>
      this.evaluateCheck(check, pkg)
    );

    const requiredChecks = results.filter((_, i) => CONFORMANCE_CHECKS[i]!.required);
    const optionalChecks = results.filter((_, i) => !CONFORMANCE_CHECKS[i]!.required);
    const requiredPassed = requiredChecks.filter((r) => r.status === "pass").length;
    const optionalPassed = optionalChecks.filter((r) => r.status === "pass").length;
    const passed = requiredChecks.every((r) => r.status === "pass");

    const summary = passed
      ? `Package '${pkg.packageId}@${pkg.packageVersion}' PASSED ecosystem conformance (${requiredPassed}/${requiredChecks.length} required, ${optionalPassed}/${optionalChecks.length} optional).`
      : `Package '${pkg.packageId}@${pkg.packageVersion}' REJECTED — ${requiredChecks.length - requiredPassed} required check(s) failed.`;

    return {
      packageId: pkg.packageId,
      packageVersion: pkg.packageVersion,
      passed,
      requiredChecksPassed: requiredPassed,
      requiredChecksTotal: requiredChecks.length,
      optionalChecksPassed: optionalPassed,
      optionalChecksTotal: optionalChecks.length,
      results,
      summary,
    };
  }

  private evaluateCheck(
    check: ConformanceCheck,
    pkg: EcosystemPackageSummary
  ): CheckResult {
    let status: CheckStatus = "fail";
    let detail = "";

    switch (check.id) {
      case "sdk-only-imports":
        status = pkg.sdkOnlyImports ? "pass" : "fail";
        detail = pkg.sdkOnlyImports
          ? "Package imports only from @kernel/api/v1"
          : "Package imports kernel internals directly";
        break;
      case "no-platform-internals":
        status = pkg.noPlatformInternals ? "pass" : "fail";
        detail = pkg.noPlatformInternals
          ? "No @kernel/<module> direct imports detected"
          : "Direct @kernel/<module> imports detected";
        break;
      case "valid-manifest":
        status = pkg.manifestValid ? "pass" : "fail";
        detail = pkg.manifestValid ? "Manifest is structurally valid" : "Manifest validation failed";
        break;
      case "valid-signature":
        status = pkg.signatureValid ? "pass" : "skip";
        detail = pkg.signatureValid ? "Signature verified" : "No signature (optional)";
        break;
      case "compatible-kernel-version":
        status = pkg.kernelVersionRange ? "pass" : "fail";
        detail = pkg.kernelVersionRange
          ? `Compatible kernel range: ${pkg.kernelVersionRange}`
          : "No kernel version range declared";
        break;
      case "passes-kernel-conformance":
        status = pkg.kernelConformancePassed ? "pass" : "fail";
        detail = pkg.kernelConformancePassed
          ? "Kernel conformance simulation suite passed"
          : "Kernel conformance simulation suite FAILED";
        break;
      case "registers-domain-ontology":
        status = pkg.domainCount > 0 ? "pass" : "fail";
        detail = `${pkg.domainCount} domain definition(s) registered`;
        break;
      case "registers-capabilities":
        status = pkg.capabilityCount > 0 ? "pass" : "fail";
        detail = `${pkg.capabilityCount} capability(ies) registered`;
        break;
      case "registers-intent-types":
        status = pkg.intentTypeCount > 0 ? "pass" : "fail";
        detail = `${pkg.intentTypeCount} intent type(s) registered`;
        break;
      case "registers-workflows":
        status = pkg.workflowCount > 0 ? "pass" : "fail";
        detail = `${pkg.workflowCount} workflow(s) registered`;
        break;
      case "registers-policies":
        status = pkg.policyCount > 0 ? "pass" : "fail";
        detail = `${pkg.policyCount} policy(ies) registered`;
        break;
      case "registers-knowledge":
        status = pkg.knowledgeCount > 0 ? "pass" : "fail";
        detail = `${pkg.knowledgeCount} knowledge artifact(s) registered`;
        break;
      case "registers-ai-workforce":
        status = pkg.aiRoleCount > 0 ? "pass" : "skip";
        detail = pkg.aiRoleCount > 0
          ? `${pkg.aiRoleCount} AI role(s) registered`
          : "No AI workforce (optional)";
        break;
      case "registers-experiences":
        status = pkg.experienceCount > 0 ? "pass" : "skip";
        detail = pkg.experienceCount > 0
          ? `${pkg.experienceCount} experience(s) registered`
          : "No experiences (optional)";
        break;
      case "registers-communication-templates":
        status = pkg.communicationTemplateCount > 0 ? "pass" : "skip";
        detail = pkg.communicationTemplateCount > 0
          ? `${pkg.communicationTemplateCount} template(s) registered`
          : "No communication templates (optional)";
        break;
      case "registers-integrations":
        status = pkg.integrationCount > 0 ? "pass" : "skip";
        detail = pkg.integrationCount > 0
          ? `${pkg.integrationCount} integration(s) registered`
          : "No integrations (optional)";
        break;
      case "registers-permissions":
        status = pkg.permissionCount > 0 ? "pass" : "fail";
        detail = `${pkg.permissionCount} permission(s) declared`;
        break;
      case "registers-telemetry":
        status = pkg.telemetryCount > 0 ? "pass" : "skip";
        detail = pkg.telemetryCount > 0
          ? `${pkg.telemetryCount} telemetry metric(s) registered`
          : "No telemetry (optional)";
        break;
      case "registers-digital-twins":
        status = pkg.twinEnabledCount > 0 ? "pass" : "skip";
        detail = pkg.twinEnabledCount > 0
          ? `${pkg.twinEnabledCount} entity type(s) with twin enabled`
          : "No digital twins (optional)";
        break;
      case "registers-governance-rules":
        status = pkg.governanceRuleCount > 0 ? "pass" : "skip";
        detail = pkg.governanceRuleCount > 0
          ? `${pkg.governanceRuleCount} governance rule(s) registered`
          : "No governance rules (optional)";
        break;
      default:
        status = "skip";
        detail = "Unknown check";
    }

    return { checkId: check.id, status, detail };
  }
}

export function createEcosystemConformanceEngine(): EcosystemConformanceEngine {
  return new DefaultEcosystemConformanceEngine();
}
