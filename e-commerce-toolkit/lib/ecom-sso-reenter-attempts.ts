/**
 * 静默换票（SSO re-enter）跨刷新计数（ecom 专用 key）。
 * 整页 re-enter 会重挂载，用 sessionStorage 累计次数。
 */

const STORAGE_KEY = "ecom_sso_reenter_attempts";

export const MAX_ECOM_SSO_REENTER_ATTEMPTS = 6;
const ATTEMPT_WINDOW_MS = 120_000;

type AttemptRecord = { n: number; ts: number };

function readRecord(): AttemptRecord {
  if (typeof window === "undefined") return { n: 0, ts: 0 };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { n: 0, ts: 0 };
    const parsed = JSON.parse(raw) as Partial<AttemptRecord>;
    const n = Number.isFinite(parsed?.n) ? Number(parsed!.n) : 0;
    const ts = Number.isFinite(parsed?.ts) ? Number(parsed!.ts) : 0;
    return { n: Math.max(0, n), ts };
  } catch {
    return { n: 0, ts: 0 };
  }
}

export function readEcomSsoReenterAttempts(): number {
  const rec = readRecord();
  if (rec.ts > 0 && Date.now() - rec.ts > ATTEMPT_WINDOW_MS) return 0;
  return rec.n;
}

export function bumpEcomSsoReenterAttempts(): number {
  const current = readEcomSsoReenterAttempts();
  const next = current + 1;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ n: next, ts: Date.now() } satisfies AttemptRecord),
      );
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function clearEcomSsoReenterAttempts(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
