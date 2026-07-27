/**
 * @kernel/governance/application/certify-artifact — use-case: certify an
 * artifact (referencing the conformance suite).
 *
 * Delegates to the `CertificationEngine` to issue a certification, then
 * RE-REGISTERS the certified version with the `GovernanceRegistry` so the
 * artifact carries its certification. The conformance-suite reference is
 * threaded through so downstream audits can trace a certification back to the
 * exact suite run that produced it.
 *
 * The use-case is a thin orchestrator. It is deterministic given its inputs.
 */

import type {
  Certification,
  CertificationKind,
} from "../domain/certification";
import type { CertificationEngine } from "../domain/certification";
import type { GovernanceRegistry } from "../domain/governance-registry";
import type { VersionArtifact } from "../domain/version-artifact";

/** Dependencies injected into the use-case. */
export interface CertifyArtifactDeps {
  readonly registry: GovernanceRegistry;
  readonly engine: CertificationEngine;
}

/** Input to the use-case. */
export interface CertifyArtifactInput {
  /** The artifact id of the subject (e.g. `"protocol/cleaning"`). */
  readonly subjectId: string;
  /** The version of the subject (e.g. `"1.0.0"`). */
  readonly subjectVersion: string;
  /** The principal issuing the certification (e.g. `"conformance-bot"`). */
  readonly certifiedBy: string;
  /** The kind of certification to issue. */
  readonly kind: CertificationKind;
  /** Opaque reference to the conformance-suite run backing this certification. */
  readonly conformanceSuiteRef?: string;
}

/**
 * Certify an artifact.
 *
 * Steps:
 *   1. Issue the certification via the CertificationEngine.
 *   2. Look up the registered VersionArtifact for `(subjectId, subjectVersion)`.
 *   3. If found, re-register it with the new `certification` set (replace-in-place).
 *      If not found, the certification is still issued (it is valid independently
 *      of registration) but no artifact is updated.
 *
 * Returns the issued certification. Pure aside from the registry mutation.
 */
export function certifyArtifact(
  deps: CertifyArtifactDeps,
  input: CertifyArtifactInput
): Certification {
  const cert = deps.engine.certify(
    input.kind,
    input.subjectId,
    input.subjectVersion,
    input.certifiedBy,
    input.conformanceSuiteRef
  );
  const existing = deps.registry.getVersion(input.subjectId, input.subjectVersion);
  if (existing) {
    const updated: VersionArtifact = {
      ...existing,
      certification: cert,
    };
    deps.registry.registerVersion(updated);
  }
  return cert;
}

/**
 * Use-case class wrapping `certifyArtifact` for callers that prefer an OO
 * style. Stateless aside from its injected deps.
 */
export class CertifyArtifact {
  constructor(private readonly deps: CertifyArtifactDeps) {}

  run(input: CertifyArtifactInput): Certification {
    return certifyArtifact(this.deps, input);
  }
}
