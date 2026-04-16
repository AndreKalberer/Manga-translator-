export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry auth failures — they won't resolve on their own
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) throw err;
      if (attempt < maxAttempts) {
        // Rate-limited: back off longer
        const delay = status === 429 ? baseDelayMs * attempt * 3 : baseDelayMs * attempt;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
}
