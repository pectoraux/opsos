/**
 * @kernel/identity/domain/credential — the Credential value object.
 *
 * A `Credential` NEVER holds a raw secret. It holds only a `secretRef` — the
 * name under which the actual secret is stored in the `Secrets` port (from
 * `@kernel/config`). This is the kernel's hard rule: secrets never enter the
 * deterministic core as plaintext; they are revealed only at the
 * infrastructure boundary (e.g. inside an `Authenticator` adapter) and never
 * persisted in events or aggregates.
 *
 * `createdAt` is sourced from `RuntimeClock` at issuance — never `Date.now()`.
 */

/** The kind of credential. Governs how the Authenticator verifies it. */
export type CredentialKind = "password" | "api-token" | "oauth" | "key";

/**
 * A reference to a secret stored externally (in the `Secrets` port). Immutable.
 * Carries enough metadata for display (e.g. "oauth provider=acme, subject=…")
 * but never the secret itself.
 */
export interface Credential {
  /** How the secret is verified (password hash, api-token, oauth, key). */
  readonly kind: CredentialKind;
  /** Name looked up via the `Secrets` port to retrieve the actual secret. */
  readonly secretRef: string;
  /** Free-form, serialisable metadata (provider, subject, hints, …). */
  readonly metadata: Readonly<Record<string, unknown>>;
  /** Epoch millis from `RuntimeClock` at issuance — never `Date.now()`. */
  readonly createdAt: number;
}
