/**
 * @kernel/coordination/application — barrel.
 *
 * The application layer of the Coordination Kernel. Use-cases that orchestrate
 * the domain engines. Depends on `domain/` and `@kernel/shared-kernel` only.
 */

export type {
  CoordinateWorkInput,
  CoordinateWorkResult,
  CoordinateWorkOutcome,
  CoordinateWork,
} from "./coordinate-work";
export { CoordinateWorkUseCase } from "./coordinate-work";
