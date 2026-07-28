/**
 * @kernel/protocol-sdk/sdk — barrel: the developer-facing DSL.
 *
 *   defineProtocol()
 *   defineCapability()
 *   defineIntent()
 *   definePolicy() / defineRule()
 *   defineWorkflow()
 *   defineCompilerStage()
 *
 * Strong typing. Autocomplete. Builder APIs. Compile-time validation where
 * possible (e.g. `defineCompilerStage` throws on `kernel.`-prefixed names).
 */
export { defineProtocol } from "./define-protocol";
export type { Protocol, ProtocolRegisterFn, DefineProtocolInput, ProtocolBuilder } from "./define-protocol";
export { defineCapability } from "./define-capability";
export type { DefineCapabilityInput } from "./define-capability";
export { defineIntent } from "./define-intent";
export type { DefineIntentInput } from "./define-intent";
export { definePolicy, defineRule } from "./define-policy";
export type { DefinePolicyInput, DefineRuleInput } from "./define-policy";
export { defineWorkflow } from "./define-workflow";
export type { DefineWorkflowInput, DefineWorkflowStageInput } from "./define-workflow";
export { defineCompilerStage } from "./define-compiler-stage";
export type { DefineCompilerStageInput } from "./define-compiler-stage";
export { defineReadModel } from "./define-read-model";
export type { DefineReadModelInput } from "./define-read-model";
