/**
 * @kernel/ecosystem-conformance/domain/ecosystem-conformance-engine — the port
 * that validates an ecosystem package against the conformance checks.
 *
 * This is the GATE: if a package fails, it is REJECTED. No ecosystem bypasses
 * the platform (ADR-0024).
 */

import type { EcosystemConformanceResult } from "./conformance-result";

export interface EcosystemPackageSummary {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly kernelVersionRange: string;
  readonly manifestValid: boolean;
  readonly signatureValid: boolean;
  readonly domainCount: number;
  readonly capabilityCount: number;
  readonly intentTypeCount: number;
  readonly workflowCount: number;
  readonly policyCount: number;
  readonly knowledgeCount: number;
  readonly aiRoleCount: number;
  readonly experienceCount: number;
  readonly communicationTemplateCount: number;
  readonly integrationCount: number;
  readonly permissionCount: number;
  readonly telemetryCount: number;
  readonly twinEnabledCount: number;
  readonly governanceRuleCount: number;
  readonly kernelConformancePassed: boolean;
  readonly sdkOnlyImports: boolean;
  readonly noPlatformInternals: boolean;
}

export interface EcosystemConformanceEngine {
  validate(pkg: EcosystemPackageSummary): EcosystemConformanceResult;
}
