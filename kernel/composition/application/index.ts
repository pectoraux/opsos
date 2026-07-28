/**
 * @kernel/composition/application — barrel.
 *
 * Re-exports the three composition use-cases: `compileProtocol`,
 * `validatePackage`, `installPackage`. Each use-case is a thin orchestrator
 * over the corresponding port; concrete implementations live in
 * `infrastructure/`.
 */

export * from "./compile-protocol";
export * from "./validate-package";
export * from "./install-package";
