/**
 * @kernel/governance/infrastructure/default-certification-engine — the default
 * `CertificationEngine` implementation.
 *
 * Issues certifications with deterministic ids derived from
 * `(kind, subjectId, subjectVersion)`. Verifications are answered by scanning
 * the in-memory store for the most recent non-revoked, non-expired
 * certification matching the subject. Expiry is evaluated lazily against the
 * injected `RuntimeClock` (default: a fixed clock at 0) — when a verify or
 * list call encounters a certification past its `expiresAt`, the stored
 * certification's status is updated to `"expired"`.
 *
 * Pure and deterministic given the clock: same clock + same inputs always
 * produce the same outputs.
 */

import type {
  Certification,
  CertificationEngine,
  CertificationKind,
  CertificationStatus,
} from "../domain/certification";
import type { RuntimeClock } from "@kernel/shared-kernel";
import { hashSeed } from "@kernel/shared-kernel";

/** A no-op clock used when the caller does not inject one. Returns 0 forever. */
class ZeroClock implements RuntimeClock {
  now(): number {
    return 0;
  }
  tick(): number {
    return 0;
  }
}

/** Deterministic certification id from (kind, subjectId, subjectVersion). */
function certId(
  kind: CertificationKind,
  subjectId: string,
  subjectVersion: string
): string {
  const h = hashSeed(`${kind}|${subjectId}|${subjectVersion}`).toString(16);
  return `cert-${kind}-${h}`;
}

/** Options for constructing a `DefaultCertificationEngine`. */
export interface DefaultCertificationEngineOptions {
  /** Optional clock for `certifiedAt` and expiry evaluation. Default: zero clock. */
  readonly clock?: RuntimeClock;
}

/**
 * The default in-memory `CertificationEngine`.
 *
 * Stores certifications in a `Map` keyed by their deterministic id, plus an
 * insertion-ordered list for `list()`. Re-certifying the same
 * `(kind, subjectId, subjectVersion)` triple replaces the prior certification
 * in-place (the new certification gets a fresh `certifiedAt` from the clock).
 */
export class DefaultCertificationEngine implements CertificationEngine {
  private readonly clock: RuntimeClock;
  /** certId → Certification. */
  private readonly certs = new Map<string, Certification>();
  /** Insertion-ordered certIds. */
  private readonly order: string[] = [];

  constructor(options: DefaultCertificationEngineOptions = {}) {
    this.clock = options.clock ?? new ZeroClock();
  }

  /** @inheritdoc */
  certify(
    kind: CertificationKind,
    subjectId: string,
    subjectVersion: string,
    certifiedBy: string,
    conformanceRef?: string
  ): Certification {
    const id = certId(kind, subjectId, subjectVersion);
    const cert: Certification = {
      id,
      kind,
      subjectId,
      subjectVersion,
      certifiedAt: this.clock.now(),
      certifiedBy,
      conformanceSuiteRef: conformanceRef,
      // No expiry by default — callers can revoke manually.
      expiresAt: undefined,
      status: "certified",
    };
    if (!this.certs.has(id)) {
      this.order.push(id);
    }
    this.certs.set(id, cert);
    return cert;
  }

  /** @inheritdoc */
  verify(subjectId: string, subjectVersion: string): Certification | undefined {
    // Lazily expire any certs past their expiresAt.
    this.expireStale();
    // Find all certs matching (subjectId, subjectVersion), keep active ones,
    // return the most recent by certifiedAt (then by id for stable tie-break).
    const matching = Array.from(this.certs.values()).filter(
      (c) =>
        c.subjectId === subjectId &&
        c.subjectVersion === subjectVersion &&
        c.status === "certified"
    );
    if (matching.length === 0) return undefined;
    matching.sort((a, b) => {
      if (a.certifiedAt !== b.certifiedAt) {
        return b.certifiedAt - a.certifiedAt;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return matching[0];
  }

  /** @inheritdoc */
  list(filter?: {
    readonly kind?: CertificationKind;
    readonly status?: CertificationStatus;
  }): readonly Certification[] {
    this.expireStale();
    let out = Array.from(this.order, (id) => this.certs.get(id)!).filter(
      (c) => c !== undefined
    );
    if (filter?.kind) {
      out = out.filter((c) => c.kind === filter.kind);
    }
    if (filter?.status) {
      out = out.filter((c) => c.status === filter.status);
    }
    return out;
  }

  /** @inheritdoc */
  revoke(certificationId: string): void {
    const existing = this.certs.get(certificationId);
    if (!existing) return; // idempotent: revoking unknown id is a no-op
    if (existing.status === "revoked") return; // idempotent
    this.certs.set(certificationId, { ...existing, status: "revoked" });
  }

  /**
   * Lazily mark any certification whose `expiresAt` is in the past (per the
   * clock) as `"expired"`. Skips certifications that are already revoked
   * (revoked is a terminal state that overrides expiry).
   */
  private expireStale(): void {
    const now = this.clock.now();
    for (const [id, cert] of this.certs) {
      if (cert.status === "revoked" || cert.status === "expired") continue;
      if (cert.expiresAt !== undefined && cert.expiresAt <= now) {
        this.certs.set(id, { ...cert, status: "expired" });
      }
    }
  }

  // ── Introspection (for tests / demos — NOT part of the port) ──────────────

  /** Total number of certifications currently in the store (any status). */
  size(): number {
    return this.certs.size;
  }
}
