/**
 * @kernel/shared-kernel — Result & Option.
 *
 * Deterministic, allocation-light, total functions. No exceptions escape the
 * deterministic core; failures are values.
 */

export type Result<T, E = KernelError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T, E = KernelError>(value: T): Result<T, E> {
  return { ok: true, value } as const;
}

export function err<T, E = KernelError>(error: E): Result<T, E> {
  return { ok: false, error } as const;
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return !r.ok;
}

/** Monadic map on the success channel. */
export function mapResult<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

/** Flatten a nested Result. */
export function flatMapResult<T, U, E>(
  r: Result<T, E>,
  f: (v: T) => Result<U, E>
): Result<U, E> {
  return r.ok ? f(r.value) : r;
}

// ── Option ──────────────────────────────────────────────────────────────────

export type Option<T> = { readonly some: true; readonly value: T } | { readonly some: false };

export function some<T>(value: T): Option<T> {
  return { some: true, value } as const;
}

export function none<T>(): Option<T> {
  return { some: false } as const;
}

export function isSome<T>(o: Option<T>): o is { some: true; value: T } {
  return o.some;
}

export function isNone<T>(o: Option<T>): o is { some: false } {
  return !o.some;
}

export function unwrapOr<T>(o: Option<T>, fallback: T): T {
  return o.some ? o.value : fallback;
}

// Forward reference to KernelError (defined in errors.ts) to break the cycle.
import type { KernelError } from "./errors";
