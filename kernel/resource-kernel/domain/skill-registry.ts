/**
 * @kernel/resource-kernel/domain/skill-registry — the SkillRegistry PORT.
 *
 * Tracks which resources are certified for which capability types, at what
 * level, and with what confidence. A `Capability` (the M1 primitive) is what
 * a resource CAN do; a `Certification` (the M7 primitive) is the auditable
 * proof — issued by an issuer, valid in a window, with a caller-supplied
 * confidence in [0, 1].
 *
 * The Coordination Kernel asks:
 *   - "is resource R certified for capabilityType X at level ≥ L?"  → isCertified
 *   - "what's the kernel's confidence in R for X?"                  → getConfidence
 *
 * Confidence is the MAX confidence across all active certifications for that
 * (resource, capabilityType) pair. Expired / revoked / pending certifications
 * are excluded from confidence but still returned by `getCertifications` for
 * auditability.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type {
  ResourceId,
  CapabilityId,
  CertificationId,
} from "@kernel/shared-kernel";
import type { Certification } from "@kernel/shared-kernel";

/**
 * The SkillRegistry PORT.
 */
export interface SkillRegistry {
  /**
   * Registers (or replaces) a certification. Re-registering the same
   * `certificationId` updates the record in place.
   */
  registerCertification(cert: Certification): void;
  /**
   * Returns ALL certifications for the resource (active, expired, revoked,
   * pending) — for auditability. Returns `[]` if none registered.
   */
  getCertifications(resourceId: ResourceId): readonly Certification[];
  /**
   * Returns `true` iff the resource has at least one ACTIVE certification for
   * `capabilityType` with `level >= minLevel`.
   *
   * A certification is active iff `status === "active"` AND (it has no
   * `expiresAt` OR `now` is not supplied OR `now <= expiresAt`).
   *
   * Note: this method does not take `now` (callers pre-filter expired certs
   * before registering if they want time-sensitive behaviour). Use
   * `isCertifiedAt` for the time-aware variant.
   */
  isCertified(
    resourceId: ResourceId,
    capabilityType: string,
    minLevel: number
  ): boolean;
  /**
   * Time-aware variant: returns `true` iff the resource has at least one
   * certification for `capabilityType` with `level >= minLevel` AND
   * `status === "active"` AND (`expiresAt` is undefined OR `now <= expiresAt`).
   */
  isCertifiedAt(
    resourceId: ResourceId,
    capabilityType: string,
    minLevel: number,
    now: number
  ): boolean;
  /**
   * Returns the MAX `confidence` across all active certifications for the
   * (resource, capabilityType) pair. Returns `0` if no active certification
   * exists. Confidence is in `[0, 1]`.
   */
  getConfidence(resourceId: ResourceId, capabilityType: string): number;
  /**
   * Time-aware variant of `getConfidence`: only counts certifications that are
   * active and not expired at `now`.
   */
  getConfidenceAt(
    resourceId: ResourceId,
    capabilityType: string,
    now: number
  ): number;
}
