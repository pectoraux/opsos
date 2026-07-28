/**
 * @kernel/workflow-runtime/application — barrel.
 *
 * The application layer of the Workflow Runtime. Use-cases that orchestrate
 * instance lifecycle (start / resume / cancel) and saga execution. Depends on
 * `domain/` and `@kernel/shared-kernel` only.
 *
 * Public surface:
 *   - StartWorkflow + StartWorkflowUseCase
 *   - ResumeWorkflow + ResumeWorkflowUseCase
 *   - CancelWorkflow + CancelWorkflowUseCase
 *   - ExecuteSaga + ExecuteSagaUseCase
 */

export type {
  StartWorkflowInput,
  StartWorkflowResult,
  StartWorkflow,
} from "./start-workflow";
export { StartWorkflowUseCase } from "./start-workflow";

export type {
  ResumeWorkflowInput,
  ResumeWorkflowResult,
  ResumeWorkflow,
} from "./resume-workflow";
export { ResumeWorkflowUseCase } from "./resume-workflow";

export type {
  CancelWorkflowInput,
  CancelWorkflowResult,
  CancelWorkflow,
} from "./cancel-workflow";
export { CancelWorkflowUseCase } from "./cancel-workflow";

export type {
  ExecuteSagaInput,
  ExecuteSagaResult,
  ExecuteSaga,
} from "./execute-saga";
export { ExecuteSagaUseCase } from "./execute-saga";
