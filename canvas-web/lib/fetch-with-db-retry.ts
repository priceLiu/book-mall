export function isTransientDbApiError(status: number, message: string): boolean {
  const t = message.trim();
  return (
    status === 502 ||
    status === 503 ||
    status === 429 ||
    t.includes("DATABASE_UNAVAILABLE") ||
    t.includes("系统繁忙")
  );
}

export function transientDbRetryDelayMs(attempt: number): number {
  return Math.min(800 + attempt * 700, 4000);
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
