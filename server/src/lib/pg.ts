/** True for a Postgres unique-index violation. drizzle wraps driver errors in
 *  DrizzleQueryError, which carries no .code of its own — the pg error hides on
 *  .cause — so walk the cause chain rather than checking the top error only. */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 5 && typeof e === 'object' && e !== null; depth++) {
    if ((e as { code?: unknown }).code === '23505') return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
