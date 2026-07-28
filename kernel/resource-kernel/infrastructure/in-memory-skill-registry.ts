/**
 * @kernel/resource-kernel/infrastructure/in-memory-skill-registry — the
 * in-memory `SkillRegistry` implementation.
 *
 * Pure data structure: a `Map<CertificationId, Certification>` plus a
 * `Map<ResourceId, CertificationId[]>` index. No `Date.now()`, no
 * `Math.random()`.
 *
 * `isCertifiedAt` and `getConfidenceAt` are the time-aware variants; the bare
 * `isCertified` / `getConfidence` ignore expiry (callers pre-filter expired
 * certs before registering if they want time-sensitive behaviour).
 */

import type {
  ResourceId,
  CertificationId,
} from "@kernel/shared-kernel";
import type { Certification } from "@kernel/shared-kernel";
import type { SkillRegistry } from "../domain";

function isActiveAt(cert: Certification, now: number): boolean {
  if (cert.status !== "active") return false;
  if (cert.expiresAt === undefined) return true;
  return now <= cert.expiresAt;
}

export class InMemorySkillRegistry implements SkillRegistry {
  private readonly certs = new Map<CertificationId, Certification>();
  private readonly byResource = new Map<ResourceId, Set<CertificationId>>();

  registerCertification(cert: Certification): void {
    const existing = this.certs.get(cert.id);
    this.certs.set(cert.id, cert);
    let set = this.byResource.get(cert.resourceId);
    if (!set) {
      set = new Set();
      this.byResource.set(cert.resourceId, set);
    }
    set.add(cert.id);
    if (existing && existing.resourceId !== cert.resourceId) {
      // Resource re-assignment: remove from old resource index.
      const oldSet = this.byResource.get(existing.resourceId);
      if (oldSet) oldSet.delete(cert.id);
    }
  }

  getCertifications(resourceId: ResourceId): readonly Certification[] {
    const set = this.byResource.get(resourceId);
    if (!set) return [];
    const out: Certification[] = [];
    for (const id of set) {
      const c = this.certs.get(id);
      if (c) out.push(c);
    }
    // Deterministic: sort by issuedAt then id.
    out.sort((a, b) =>
      a.issuedAt !== b.issuedAt
        ? a.issuedAt - b.issuedAt
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
    );
    return out;
  }

  isCertified(
    resourceId: ResourceId,
    capabilityType: string,
    minLevel: number
  ): boolean {
    const certs = this.getCertifications(resourceId);
    return certs.some(
      (c) =>
        c.status === "active" &&
        c.capabilityType === capabilityType &&
        c.level >= minLevel
    );
  }

  isCertifiedAt(
    resourceId: ResourceId,
    capabilityType: string,
    minLevel: number,
    now: number
  ): boolean {
    const certs = this.getCertifications(resourceId);
    return certs.some(
      (c) =>
        isActiveAt(c, now) &&
        c.capabilityType === capabilityType &&
        c.level >= minLevel
    );
  }

  getConfidence(resourceId: ResourceId, capabilityType: string): number {
    const certs = this.getCertifications(resourceId);
    let max = 0;
    for (const c of certs) {
      if (
        c.status === "active" &&
        c.capabilityType === capabilityType &&
        c.confidence > max
      ) {
        max = c.confidence;
      }
    }
    return max;
  }

  getConfidenceAt(
    resourceId: ResourceId,
    capabilityType: string,
    now: number
  ): number {
    const certs = this.getCertifications(resourceId);
    let max = 0;
    for (const c of certs) {
      if (
        isActiveAt(c, now) &&
        c.capabilityType === capabilityType &&
        c.confidence > max
      ) {
        max = c.confidence;
      }
    }
    return max;
  }
}
