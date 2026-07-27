/**
 * @kernel/resource-kernel/application — barrel.
 *
 * The application layer of the Resource Kernel. Use-cases that orchestrate
 * the domain engines. Depends on `domain/` and `@kernel/shared-kernel` only.
 *
 * Public surface:
 *   - FindCapableResources use-case + FindCapableResourcesUseCase class +
 *     FindCapableResourcesInput / FindCapableFilters
 *   - ReserveCapacity use-case + ReserveCapacityUseCase class +
 *     ReserveCapacityInput / ReserveCapacityResult / ReserveCapacityOutcome
 *   - UpdateTwin use-case + UpdateTwinUseCase class +
 *     UpdateTwinInput / UpdateTwinResult
 */

export type {
  FindCapableResourcesInput,
  FindCapableFilters,
  FindCapableResources,
} from "./find-capable-resources";
export { FindCapableResourcesUseCase } from "./find-capable-resources";

export type {
  ReserveCapacityInput,
  ReserveCapacityResult,
  ReserveCapacityOutcome,
  ReserveCapacity,
} from "./reserve-capacity";
export { ReserveCapacityUseCase } from "./reserve-capacity";

export type {
  UpdateTwinInput,
  UpdateTwinResult,
  UpdateTwin,
} from "./update-twin";
export { UpdateTwinUseCase } from "./update-twin";
