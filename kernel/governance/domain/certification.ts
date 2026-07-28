/**
 * @kernel/governance/domain/certification — the certification contract.
 *
 * A `Certification` is an authoritative claim that a specific subject (an
 * artifact at a specific version) has been verified against a conformance
 * suite or compatibility matrix. Certifications are ISSUED by the
 * CertificationEngine and VERIFIED by anyone (the package installer, the
 * protocol registry, the application installer, …) before accepting an
 * artifact into a governed surface.
 *
 * The five `CertificationKind`s:
 *   - `protocol-certified`:        a protocol passed the kernel conformance suite.
 *   - `package-certified`:         a composed package is signed and dependencies resolve.
 *   - `domain-certified`:          a domain model is internally consistent and conforms.
 *   - `ai-provider-compatible`:    an AI provider bundle implements the AI contracts.
 *   - `kernel-compatible`:         an artifact is compatible with a specific kernel version.
 *
 * Certifications have a lifecycle (`pending → certified → revoked|expired`).
 * `expiresAt` is optional; absent means the certification does not expire.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

/**
 * The five kinds of certification the framework can issue.
 */
export type CertificationKind =
  | "protocol-certified"
  | "package-certified"
  | "domain-certified"
  | "ai-provider-compatible"
  | "kernel-compatible";

/**
 * The four states a certification can be in.
 *
 * - `pending`:   issued but not yet verified (rare; usually certify() flips straight to `certified`).
 * - `certified`: active and verifiable.
 * - `revoked`:   manually invalidated (e.g. a vulnerability was discovered).
 * - `expired`:   past its `expiresAt` (only set by the engine when queried past expiry).
 */
export type CertificationStatus =
  | "pending"
  | "certified"
  | "revoked"
  | "expired";

/**
 * An authoritative certification claim.
 *
 * `subjectId` + `subjectVersion` together identify the certified subject (the
 * `(id, version)` pair of a `VersionArtifact`). The framework does NOT enforce
 * that the subject is registered — certifications can be issued against
 * not-yet-registered subjects (e.g. a protocol can be certified before its
 * version is registered with the governance registry).
 *
 * `conformanceSuiteRef` is an opaque reference to the conformance suite run
 * that produced the certification (e.g. `"conformance-suite@095ee579"`). The
 * framework stores it verbatim; it does not interpret it.
 */
export interface Certification {
  /** Stable certification id (deterministically derived from kind + subject + version). */
  readonly id: string;
  /** What kind of certification this is. */
  readonly kind: CertificationKind;
  /** The subject's stable id (e.g. `"protocol/cleaning"`). */
  readonly subjectId: string;
  /** The subject's version (e.g. `"1.0.0"`). */
  readonly subjectVersion: string;
  /** Epoch-millis when the certification was issued (caller-supplied — never Date.now()). */
  readonly certifiedAt: number;
  /** The principal that issued the certification (e.g. `"conformance-bot"`, `"security-team"`). */
  readonly certifiedBy: string;
  /** Opaque reference to the conformance-suite run backing this certification. */
  readonly conformanceSuiteRef?: string;
  /** Optional expiry timestamp. Absent means the certification does not expire. */
  readonly expiresAt?: number;
  /** Current status of the certification. */
  readonly status: CertificationStatus;
}

/**
 * The CertificationEngine PORT. Implementations issue, verify, list, and
 * revoke certifications. The default in-memory implementation lives in
 * `infrastructure/default-certification-engine.ts`.
 *
 * This is a PORT (interface only) — the deterministic core never depends on a
 * concrete implementation.
 */
export interface CertificationEngine {
  /**
   * Issue a certification. The resulting certification has `status: "certified"`
   * unless the caller is creating a `pending` certification (engines may
   * support a pending state, then `verify()` flips it to `certified`).
   */
  certify(
    kind: CertificationKind,
    subjectId: string,
    subjectVersion: string,
    certifiedBy: string,
    conformanceRef?: string
  ): Certification;

  /**
   * Verify whether a subject is currently certified. Returns the most recent
   * non-revoked, non-expired certification for the subject, or `undefined`.
   */
  verify(subjectId: string, subjectVersion: string): Certification | undefined;

  /**
   * List certifications, optionally filtered by kind and/or status.
   */
  list(filter?: {
    readonly kind?: CertificationKind;
    readonly status?: CertificationStatus;
  }): readonly Certification[];

  /**
   * Revoke a certification by id. Idempotent — revoking an already-revoked
   * certification is a no-op.
   */
  revoke(certificationId: string): void;
}
