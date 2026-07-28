/**
 * @kernel/composition/domain/package-signature — `PackageSignature` and the
 * four signature-related PORTs (`Signer`, `Verifier`, `DigestProvider`,
 * `SignatureStore`).
 *
 * A built `OperationalPackage` carries an OPTIONAL signature: a detached
 * attestation by a signer that the package digest matches what they intended
 * to publish. In production this is real public-key cryptography (Ed25519,
 * PGP, sigstore). The composition layer does NOT mandate any particular
 * algorithm — it only defines the PORTs. A non-cryptographic demo signer is
 * provided in `infrastructure/demo-signer.ts` and is clearly marked as NOT
 * production cryptography.
 *
 * Pure domain layer (interface declarations + the `PackageSignature` value
 * object).
 */

import type { PackageDigest } from "./package-artifact";
import type { OperationalPackage } from "./operational-package";

/**
 * A signature over a package's digest.
 *
 *   `signerId`   — the stable identifier of the signer (e.g. an OpenPGP
 *                  fingerprint, a did:key, an internal principal id).
 *   `digest`     — the digest that was signed (must match `pkg.digest`).
 *   `signature`  — the signature bytes, encoded as a string (hex / base64 /
 *                  JWS compact). The encoding is determined by `algorithm`.
 *   `algorithm`  — the signature algorithm identifier
 *                  (e.g. `"ed25519"`, `"pgp"`, `"demo-djb2"`).
 *   `signedAt`   — epoch milliseconds when the signature was produced
 *                  (sourced from the `now` argument — never `Date.now()`).
 */
export interface PackageSignature {
  readonly signerId: string;
  readonly digest: PackageDigest;
  readonly signature: string;
  readonly algorithm: string;
  readonly signedAt: number;
}

/**
 * PORT `Signer` — produces a `PackageSignature` for a digest.
 *
 * Implementations may be synchronous (the demo signer) or asynchronous (a
 * real KMS-backed signer). The signer's `id` is included in every signature
 * it produces.
 */
export interface Signer {
  readonly id: string;
  sign(digest: PackageDigest): Promise<PackageSignature> | PackageSignature;
}

/**
 * PORT `Verifier` — verifies that a package's signature matches its digest
 * and was produced by a trusted signer.
 *
 * Returns a boolean: true iff the signature is valid AND the signer is
 * trusted. Implementations MAY consult a `SignatureStore` or external trust
 * root; the demo verifier trusts everything (clearly marked as unsafe).
 */
export interface Verifier {
  verify(pkg: OperationalPackage): boolean;
}

/**
 * PORT `DigestProvider` — computes a `PackageDigest` over a `PackageContents`.
 *
 * The digest is a deterministic hash of the serialised contents. Two
 * byte-identical contents MUST yield byte-identical digests — this is what
 * makes package integrity verifiable. The default demo provider uses a
 * deterministic djb2-style hash over a canonical JSON serialisation
 * (NOT cryptographically strong; suitable only for replay and integrity
 * checking in trusted environments).
 */
export interface DigestProvider {
  compute(contents: PackageContents): PackageDigest;
}

/**
 * PORT `SignatureStore` — persists package signatures so verifiers can recall
 * them later. Useful for offline verification and audit trails.
 */
export interface SignatureStore {
  save(pkg: OperationalPackage): void;
  verify(id: string, version: string): boolean;
}

// Forward-declared type re-exports (kept here so callers can import everything
// signature-related from this file). The actual definitions live in
// `package-artifact.ts` and `operational-package.ts` to avoid a cycle.
import type { PackageContents } from "./package-artifact";
