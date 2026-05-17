/** Extract a string message from a caught error (Error or non-Error).
 *  Uses explicit if/else instead of ternary for reliable V8 branch coverage tracking. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
