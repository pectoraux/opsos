/**
 * @kernel/ecosystem-conformance/domain/conformance-check — the individual
 * checks that an ecosystem package must pass before installation.
 *
 * Each check is a declarative, serializable specification — NOT a JS function.
 * This ensures the conformance suite is itself replayable and transportable.
 */

export type ConformanceCheckId =
  | "sdk-only-imports"
  | "registers-domain-ontology"
  | "registers-workflows"
  | "registers-ai-workforce"
  | "registers-experiences"
  | "registers-communication-templates"
  | "registers-integrations"
  | "registers-permissions"
  | "registers-telemetry"
  | "registers-digital-twins"
  | "registers-governance-rules"
  | "registers-capabilities"
  | "registers-intent-types"
  | "registers-policies"
  | "registers-knowledge"
  | "passes-kernel-conformance"
  | "no-platform-internals"
  | "valid-manifest"
  | "valid-signature"
  | "compatible-kernel-version";

export interface ConformanceCheck {
  readonly id: ConformanceCheckId;
  readonly category: "sdk-boundary" | "registration" | "validation" | "compatibility";
  readonly description: string;
  readonly required: boolean;
}

export const CONFORMANCE_CHECKS: readonly ConformanceCheck[] = [
  { id: "sdk-only-imports", category: "sdk-boundary", description: "Package imports only from @kernel/api/v1 — no kernel internals", required: true },
  { id: "no-platform-internals", category: "sdk-boundary", description: "Package does not import from any @kernel/<module> path directly", required: true },
  { id: "valid-manifest", category: "validation", description: "Package manifest passes structural validation", required: true },
  { id: "valid-signature", category: "validation", description: "Package has a valid signature from an approved signer", required: false },
  { id: "compatible-kernel-version", category: "compatibility", description: "Package declares compatible kernel version range", required: true },
  { id: "passes-kernel-conformance", category: "compatibility", description: "Package passes the kernel conformance simulation suite", required: true },
  { id: "registers-domain-ontology", category: "registration", description: "Package registers at least one domain definition", required: true },
  { id: "registers-capabilities", category: "registration", description: "Package registers at least one capability", required: true },
  { id: "registers-intent-types", category: "registration", description: "Package registers at least one intent type", required: true },
  { id: "registers-workflows", category: "registration", description: "Package registers at least one workflow", required: true },
  { id: "registers-policies", category: "registration", description: "Package registers at least one policy", required: true },
  { id: "registers-knowledge", category: "registration", description: "Package registers at least one knowledge artifact", required: true },
  { id: "registers-ai-workforce", category: "registration", description: "Package registers at least one AI role or agent definition", required: false },
  { id: "registers-experiences", category: "registration", description: "Package registers at least one experience definition", required: false },
  { id: "registers-communication-templates", category: "registration", description: "Package registers at least one communication template", required: false },
  { id: "registers-integrations", category: "registration", description: "Package registers at least one integration connector", required: false },
  { id: "registers-permissions", category: "registration", description: "Package declares all required permissions", required: true },
  { id: "registers-telemetry", category: "registration", description: "Package registers at least one telemetry metric", required: false },
  { id: "registers-digital-twins", category: "registration", description: "Package enables digital twins for at least one entity type", required: false },
  { id: "registers-governance-rules", category: "registration", description: "Package registers at least one governance rule", required: false },
];
