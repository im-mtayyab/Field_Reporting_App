/** Forces TypeScript to error when a switch misses a union member. */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled case: ${String(value)}`);
}
