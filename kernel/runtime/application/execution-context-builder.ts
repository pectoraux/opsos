/**
 * @kernel/runtime/application/execution-context-builder — fluent builder for
 * `ExecutionContext`.
 *
 * Required dependencies: `clock`, `random`, `observability`, `config`.
 * Optional: `principalId`, `tenantId`, `correlationId` (defaults to
 * `random.uuid()`), `traceId` (defaults to `correlationId`), `causationId`,
 * `metadata`.
 *
 * The concrete `ExecutionContext` implementation is a private class; callers
 * interact only through the `ExecutionContext` interface and this builder /
 * the `createExecutionContext` convenience factory.
 */

import type {
  RuntimeClock,
  RandomSource,
  PrincipalId,
  TenantId,
} from "@kernel/shared-kernel";
import type { ObservabilityBundle } from "@kernel/observability";
import type { ConfigRegistry } from "@kernel/config";
import type {
  ExecutionContext,
  ExecutionContextOverrides,
} from "../domain/execution-context";

/** Private, immutable implementation of `ExecutionContext`. */
class RuntimeExecutionContext implements ExecutionContext {
  constructor(
    readonly clock: RuntimeClock,
    readonly random: RandomSource,
    readonly observability: ObservabilityBundle,
    readonly config: ConfigRegistry,
    readonly principalId: PrincipalId | null,
    readonly tenantId: TenantId | null,
    readonly correlationId: string,
    readonly traceId: string,
    readonly causationId: string | undefined,
    readonly metadata: Readonly<Record<string, unknown>>
  ) {}

  derive(overrides?: Partial<ExecutionContextOverrides>): ExecutionContext {
    // Shared deps are passed by reference; only the overrideable fields are
    // re-evaluated. `!== undefined` distinguishes "not supplied" from
    // "supplied as null/undefined" so callers can clear a field explicitly.
    return new RuntimeExecutionContext(
      this.clock,
      this.random,
      this.observability,
      this.config,
      overrides && overrides.principalId !== undefined
        ? overrides.principalId
        : this.principalId,
      overrides && overrides.tenantId !== undefined
        ? overrides.tenantId
        : this.tenantId,
      overrides && overrides.correlationId !== undefined
        ? overrides.correlationId
        : this.correlationId,
      overrides && overrides.traceId !== undefined
        ? overrides.traceId
        : this.traceId,
      overrides && overrides.causationId !== undefined
        ? overrides.causationId
        : this.causationId,
      overrides && overrides.metadata !== undefined
        ? overrides.metadata
        : this.metadata
    );
  }
}

/** Dependencies required to build an `ExecutionContext`. */
export interface ExecutionContextDeps {
  readonly clock: RuntimeClock;
  readonly random: RandomSource;
  readonly observability: ObservabilityBundle;
  readonly config: ConfigRegistry;
  readonly principalId?: PrincipalId | null;
  readonly tenantId?: TenantId | null;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly causationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Fluent builder. Required deps MUST be set before `build()`; optional fields
 * default as documented above.
 */
export class ExecutionContextBuilder {
  private _clock?: RuntimeClock;
  private _random?: RandomSource;
  private _observability?: ObservabilityBundle;
  private _config?: ConfigRegistry;
  private _principalId: PrincipalId | null = null;
  private _tenantId: TenantId | null = null;
  private _correlationId?: string;
  private _traceId?: string;
  private _causationId?: string;
  private _metadata: Readonly<Record<string, unknown>> = {};

  withClock(clock: RuntimeClock): this {
    this._clock = clock;
    return this;
  }
  withRandom(random: RandomSource): this {
    this._random = random;
    return this;
  }
  withObservability(observability: ObservabilityBundle): this {
    this._observability = observability;
    return this;
  }
  withConfig(config: ConfigRegistry): this {
    this._config = config;
    return this;
  }
  withPrincipal(principalId: PrincipalId | null | undefined): this {
    this._principalId = principalId ?? null;
    return this;
  }
  withTenant(tenantId: TenantId | null | undefined): this {
    this._tenantId = tenantId ?? null;
    return this;
  }
  withCorrelation(correlationId: string | undefined): this {
    if (correlationId !== undefined) this._correlationId = correlationId;
    return this;
  }
  withTrace(traceId: string | undefined): this {
    if (traceId !== undefined) this._traceId = traceId;
    return this;
  }
  withCausation(causationId: string | undefined): this {
    if (causationId !== undefined) this._causationId = causationId;
    return this;
  }
  withMetadata(metadata: Readonly<Record<string, unknown>>): this {
    this._metadata = metadata;
    return this;
  }

  build(): ExecutionContext {
    if (!this._clock) throw new Error("ExecutionContextBuilder: clock is required");
    if (!this._random)
      throw new Error("ExecutionContextBuilder: random is required");
    if (!this._observability)
      throw new Error("ExecutionContextBuilder: observability is required");
    if (!this._config)
      throw new Error("ExecutionContextBuilder: config is required");

    const correlationId = this._correlationId ?? this._random.uuid();
    const traceId = this._traceId ?? correlationId;

    return new RuntimeExecutionContext(
      this._clock,
      this._random,
      this._observability,
      this._config,
      this._principalId,
      this._tenantId,
      correlationId,
      traceId,
      this._causationId,
      this._metadata
    );
  }
}

/**
 * Convenience factory: build an `ExecutionContext` from a deps object in one
 * call. Equivalent to chaining the `with*` methods on `ExecutionContextBuilder`.
 */
export function createExecutionContext(deps: ExecutionContextDeps): ExecutionContext {
  return new ExecutionContextBuilder()
    .withClock(deps.clock)
    .withRandom(deps.random)
    .withObservability(deps.observability)
    .withConfig(deps.config)
    .withPrincipal(deps.principalId ?? null)
    .withTenant(deps.tenantId ?? null)
    .withCorrelation(deps.correlationId)
    .withTrace(deps.traceId)
    .withCausation(deps.causationId)
    .withMetadata(deps.metadata ?? {})
    .build();
}
