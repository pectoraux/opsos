/**
 * @kernel/composition/infrastructure/demo-signer — `DemoSigner`,
 * `DemoVerifier`, `DemoDigestProvider`.
 *
 * A NON-CRYPTOGRAPHIC demo signer. It produces a deterministic hash-based
 * "signature" over a digest using the same djb2-style hash as the digest
 * provider. This is clearly marked "NOT production cryptography" — it exists
 * so the composition pipeline has an end-to-end signature path WITHOUT
 * pulling in a real cryptographic library (which the kernel deliberately
 * keeps out of the deterministic core).
 *
 * Use this for:
 *   - Tests.
 *   - Local development.
 *   - Deterministic replay (the demo signer is purely functional over the
 *     digest + a fixed signerId).
 *
 * Do NOT use this for:
 *   - Production package signing.
 *   - Any environment where untrusted packages may be installed.
 *
 * Determinism: `sign(digest)` is purely functional over `digest` + the
 * signer's fixed `id`. The same digest + signerId ALWAYS produces the same
 * signature.
 */

import { hashSeed } from "@kernel/shared-kernel";
import type {
  DigestProvider,
  PackageContents,
  PackageDigest,
  PackageSignature,
  Signer,
  Verifier,
  OperationalPackage,
} from "../domain";
import { COMPOSITION_COMPILER_VERSION } from "../domain";

/**
 * Canonical JSON serialisation: keys sorted, stable stringifier. Used by the
 * demo digest provider so identical contents always yield identical hashes.
 *
 * NOTE: this is NOT a general-purpose stable JSON library — it handles the
 * shapes that `PackageContents` can contain (records of primitives, arrays,
 * nested records). Functions and `undefined` values are dropped (matching
 * `JSON.stringify` semantics).
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => canonicalStringify(v));
    return `[${items.join(",")}]`;
  }
  // Object — sort keys for determinism.
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify(
      (value as Record<string, unknown>)[k]
    )}`
  );
  return `{${pairs.join(",")}}`;
}

/** The demo hash algorithm identifier. */
export const DEMO_DIGEST_ALGORITHM = "djb2-demo";

/** The demo signature algorithm identifier. */
export const DEMO_SIGNATURE_ALGORITHM = "demo-djb2";

/**
 * `DemoDigestProvider` — computes a deterministic `PackageDigest` over a
 * `PackageContents` using a djb2-style hash of the canonical JSON
 * serialisation. NOT cryptographically strong.
 */
export class DemoDigestProvider implements DigestProvider {
  compute(contents: PackageContents): PackageDigest {
    // Compose a stable serialisation of the contents. The order of fields is
    // fixed so the hash is deterministic regardless of how the object was
    // constructed.
    const payload = {
      domainBindings: contents.domainBindings,
      knowledgeRefs: [...contents.knowledgeRefs],
      compilerExtensions: [...contents.compilerExtensions],
      policies: [...contents.policies],
      capabilities: [...contents.capabilities],
      workflows: [...contents.workflows],
      resourceRequirements: [...contents.resourceRequirements],
      measurements: [...contents.measurements],
      uiExtensions: [...contents.uiExtensions],
      apiRoutes: [...contents.apiRoutes],
      analytics: [...contents.analytics],
      configDefaults: contents.configDefaults,
    };
    const canon = canonicalStringify(payload);
    // Two-pass hash for slightly better distribution. Pure and deterministic.
    const h1 = hashSeed(canon);
    const h2 = hashSeed(canon + "::" + h1.toString(16));
    const hash = (h1 >>> 0).toString(16).padStart(8, "0") +
      (h2 >>> 0).toString(16).padStart(8, "0");
    return { algorithm: DEMO_DIGEST_ALGORITHM, hash };
  }
}

/**
 * `DemoSigner` — produces a deterministic hash-based "signature" over a
 * digest. NOT production cryptography.
 *
 * The signature is `hashSeed(digest.hash + "::" + signerId)`. This is purely
 * deterministic — useful for replay and tests.
 */
export class DemoSigner implements Signer {
  readonly id: string;

  constructor(id: string = "demo-signer") {
    this.id = id;
  }

  sign(digest: PackageDigest): PackageSignature {
    const canon = `${digest.algorithm}::${digest.hash}::${this.id}`;
    const h1 = hashSeed(canon);
    const h2 = hashSeed(canon + "::" + h1.toString(16));
    const sig = (h1 >>> 0).toString(16).padStart(8, "0") +
      (h2 >>> 0).toString(16).padStart(8, "0");
    return {
      signerId: this.id,
      digest,
      signature: sig,
      algorithm: DEMO_SIGNATURE_ALGORITHM,
      // signedAt is the caller's responsibility — we cannot use Date.now().
      // We default to 0 here; the pipeline overrides this with the `now`
      // argument from the composition input.
      signedAt: 0,
    };
  }
}

/**
 * `DemoVerifier` — verifies a package's signature was produced by the demo
 * signer. NOT production cryptography — it trusts the demo algorithm.
 *
 * Returns true iff:
 *   1. The package has a signature.
 *   2. The signature's digest matches the package's digest.
 *   3. Re-signing the digest with the demo signer (using the signature's
 *      signerId) produces the same signature string.
 */
export class DemoVerifier implements Verifier {
  verify(pkg: OperationalPackage): boolean {
    if (!pkg.signature) return false;
    const sig = pkg.signature;
    if (sig.digest.algorithm !== pkg.digest.algorithm) return false;
    if (sig.digest.hash !== pkg.digest.hash) return false;
    // Re-derive using a demo signer with the same id.
    const reSigner = new DemoSigner(sig.signerId);
    const expected = reSigner.sign(pkg.digest).signature;
    return expected === sig.signature;
  }
}
