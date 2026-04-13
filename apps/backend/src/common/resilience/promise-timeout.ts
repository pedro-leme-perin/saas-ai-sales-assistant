/**
 * Wraps a Promise.all with a timeout to prevent indefinite hangs.
 * Based on Release It! — "Never wait forever" principle.
 *
 * Preserves tuple types from Promise.all so destructuring works correctly
 * with mixed-type promise arrays (e.g., [count, count, aggregate]).
 *
 * @param promises - Tuple of promises to race against timeout
 * @param timeoutMs - Maximum time to wait (default: 30000ms)
 * @param label - Label for timeout error message (debugging)
 * @returns Promise resolving to tuple of results (same as Promise.all)
 * @throws Error if timeout is reached before all promises resolve
 */
export function promiseAllWithTimeout<T extends readonly unknown[]>(
  promises: readonly [...{ [K in keyof T]: Promise<T[K]> }],
  timeoutMs = 30000,
  label = 'Promise.all',
): Promise<[...T]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
  );

  return Promise.race([
    Promise.all(promises) as Promise<[...T]>,
    timeout,
  ]);
}
