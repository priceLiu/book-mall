/**
 * 静默换票（SSO re-enter）跨刷新计数。
 *
 * 每次静默 re-enter 都是整页跳转（子站 → book-mall re-enter → 回子站），
 * 组件会重新挂载，无法用内存变量统计次数；这里用 sessionStorage 在同一标签页内累计。
 *
 * - 达到 MAX 次仍未建立会话 → 停止自动换票，提示用户重新登录。
 * - 超过时间窗（会话久后才失效的新一轮）→ 计数自动归零，重新开始静默换票。
 * - 会话建立成功后调用 clear 归零。
 */

const STORAGE_KEY = "prompt_sso_reenter_attempts";
/** 连续静默换票上限；超过则改为人工「重新登录」。 */
export const MAX_SSO_REENTER_ATTEMPTS = 6;
/** 计数有效窗口；超出视为新一轮失效，计数归零。 */
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

/** 当前已用静默换票次数（超出时间窗自动归零）。 */
export function readSsoReenterAttempts(): number {
  const rec = readRecord();
  if (rec.ts > 0 && Date.now() - rec.ts > ATTEMPT_WINDOW_MS) return 0;
  return rec.n;
}

/** 记一次静默换票并返回累计次数。 */
export function bumpSsoReenterAttempts(): number {
  const current = readSsoReenterAttempts();
  const next = current + 1;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ n: next, ts: Date.now() } satisfies AttemptRecord),
      );
    } catch {
      /* 忽略存储失败 */
    }
  }
  return next;
}

/** 会话建立成功 / 用户手动重试时归零。 */
export function clearSsoReenterAttempts(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}
