/**
 * @kernel/protocol-sdk/interfaces — public surface.
 *
 * The Protocol SDK: turns OpsOS from a kernel into an extensible operating
 * system. Protocols describe work; they never execute it. The compiler
 * compiles; the runtime executes; protocols describe; applications present.
 *
 * Everything outside the kernel depends on `@kernel/api/v1` (which re-exports
 * this module's public surface).
 */
export * from "../manifest";
export * from "../validation";
export * from "../lifecycle";
export * from "../capabilities";
export * from "../intents";
export * from "../compiler";
export * from "../workflows";
export * from "../policy";
export * from "../read-models";
export * from "../analytics";
export * from "../ui";
export * from "../routes";
export * from "../recommendations";
export * from "../events";
export * from "../pricing";
export * from "../registry";
export * from "../sdk";
export { demoProtocol } from "../demo/demo-protocol";
