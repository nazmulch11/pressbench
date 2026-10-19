/**
 * Result type for operations whose failure is expected and must be handled by the caller
 * (docs/CODING_STANDARDS.md §2). Throw only for programmer errors.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Wraps a success value. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Wraps a failure. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
