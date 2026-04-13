/**
 * Wraps a Promise.all with a timeout to prevent indefinite hangs.
 * Based on Release It! — "Never wait forever" principle.
 *
 * @param promises - Array of promises to race against timeout
 * @param timeoutMs - Maximum time to wait (default: 30000ms)
 * @param label - Label for timeout error message (debugging)
 * @returns Promise resolving to array of results
 * @throws Error if timeout is reached before all promises resolve
 */
export function promiseAllWithTimeout<T>(
  promises: Promise<T>[],
  timeoutMs = 30000,
  label = 'Promise.all',
): Promise<T[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
  );

  return Promise.race([Promise.all(promises), timeout]);
}
