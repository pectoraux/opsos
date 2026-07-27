/**
 * @kernel/governance/domain/governance-policy — declarative governance policies.
 *
 * A `GovernancePolicy` is a declarative rule that governs HOW the platform
 * evolves. Policies do NOT change operational behaviour — they govern the
 * process of evolution (e.g. "no breaking changes inside a major version",
 * "API freeze 2 weeks before each major release", "every published protocol
 * must carry a `protocol-certified` certification").
 *
 * The seven `GovernancePolicyKind`s cover every governance decision OpsOS
 * makes:
 *
 *   - `breaking-changes`:        rules constraining when breaking changes are allowed.
 *   - `api-freeze`:              rules defining API-freeze windows before releases.
 *   - `protocol-certification`:  rules requiring protocols to be certified.
 *   - `package-approval`:        rules requiring packages to be approved before install.
 *   - `extension-approval`:      rules requiring extensions to be approved before activation.
 *   - `domain-publication`:      rules governing domain model publication.
 *   - `security-review`:         rules requiring security review for sensitive changes.
 *
 * The three `EnforcementLevel`s:
 *   - `advisory`:  the policy is reported but does not block.
 *   - `required`:  the policy must be satisfied; violations are errors.
 *   - `blocking`:  the policy blocks the operation outright (highest severity).
 *
 * `rules` is a serialisable record (NOT a JS function) — policies are
 * replayable, transportable, and auditable. The framework does NOT interpret
 * rule contents; it stores and exposes them for downstream enforcers.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

/**
 * The seven kinds of governance policy.
 */
export type GovernancePolicyKind =
  | "breaking-changes"
  | "api-freeze"
  | "protocol-certification"
  | "package-approval"
  | "extension-approval"
  | "domain-publication"
  | "security-review";

/**
 * The three enforcement levels, in increasing severity.
 */
export type EnforcementLevel = "advisory" | "required" | "blocking";

/**
 * A declarative governance policy.
 *
 * `rules` is an opaque, serialisable record (e.g.
 * `{ allowBreakingChangesInMajor: true, minimumNoticeDays: 14 }`). The
 * framework stores it verbatim; downstream enforcers (release tooling, CI
 * gates, the package installer) interpret the fields they recognise.
 *
 * `enforcement` declares the severity. `advisory` policies produce warnings;
 * `required` policies produce errors; `blocking` policies halt the operation.
 */
export interface GovernancePolicy {
  /** Stable policy id (caller-supplied). */
  readonly id: string;
  /** Which kind of governance this policy expresses. */
  readonly kind: GovernancePolicyKind;
  /** Serialisable, opaque rule contents. */
  readonly rules: Readonly<Record<string, unknown>>;
  /** The enforcement severity. */
  readonly enforcement: EnforcementLevel;
  /** Human-readable description of what the policy requires. */
  readonly description: string;
}
