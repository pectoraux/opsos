/**
 * @kernel/protocol-sdk/manifest — barrel.
 */
export type {
  SemverString,
  SemverRange,
  ProtocolDependency,
  ProtocolPermission,
  ProtocolAuthor,
  ProtocolManifest,
} from "./protocol-manifest";
export { KERNEL_API_VERSION, KERNEL_VERSION } from "./protocol-manifest";
export {
  validateProtocolManifest,
  manifestIsValid,
} from "./manifest-validation";
export type { ManifestDiagnostic } from "./manifest-validation";
