/**
 * @kernel/conformance/domain/failure-injection — declarative configuration for
 * injecting a failure into the simulated pipeline.
 *
 * The `kind` selects the failure mode; `target` names the resource / demand /
 * stage / package / knowledge item the failure applies to; `params` carries
 * the failure-specific knobs (TTL override, error message, version, etc.).
 *
 * All kinds are GENERIC — they describe kernel CONTRACT failures (a resource
 * is unavailable, a reservation expired, a compiler stage threw), never
 * industry-specific business failures.
 */
import type { UnknownRecord } from "@kernel/shared-kernel";

export type FailureInjectionKind =
  | "unavailable-resource"
  | "expired-reservation"
  | "policy-failure"
  | "compiler-failure"
  | "package-incompatibility"
  | "extension-failure"
  | "network-partition"
  | "stale-knowledge"
  | "capacity-exhaustion";

export interface FailureInjectionConfig {
  readonly kind: FailureInjectionKind;
  readonly target: string;
  readonly params?: UnknownRecord;
}
