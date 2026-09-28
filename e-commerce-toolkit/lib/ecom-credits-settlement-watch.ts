import { dispatchEcomCreditsBalanceRefresh } from "@/lib/ecom-credits-balance-events";

export const ECOM_CREDITS_SETTLEMENT_EVENT = "ecom:credits-settlement";

export type EcomCreditsSettlementPhase =
  | "frozen"
  | "settled"
  | "consumed"
  | "released"
  | "none"
  | "pending";

export type EcomCreditsSettlementDetail = {
  logId: string;
  phase: Exclude<EcomCreditsSettlementPhase, "pending">;
  credits: number;
};

const watching = new Set<string>();
const DELAYS_MS = [400, 1500, 4000, 9000, 20000, 45000, 90000];

export const ECOM_GATEWAY_LOG_HEADER = "x-ecom-gateway-log-id";

export function collectEcomGatewayLogIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 8) ids.push(value.trim());
  };
  push(data.logId);
  push(data.gatewayLogId);
  if (Array.isArray(data.logIds)) {
    for (const id of data.logIds) push(id);
  }
  return [...new Set(ids)];
}

function shouldRefreshBalance(path: string, method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  if (m !== "POST" && m !== "PUT") return false;
  return /\/(generate|render|compose|erase|tryon|decompose)(\/|$)/.test(path)
    || path.includes("image-processing/edit")
    || path.includes("/assistant/chat");
}

function emit(detail: EcomCreditsSettlementDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ECOM_CREDITS_SETTLEMENT_EVENT, { detail }),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchSettlement(logId: string): Promise<{
  phase: EcomCreditsSettlementPhase;
  credits: number;
} | null> {
  const { ecomBookFetch } = await import("@/lib/ecom-book-fetch");
  try {
    const data = await ecomBookFetch(
      `api/sso/tools/ecom/credits/settlement?logId=${encodeURIComponent(logId)}`,
      { cache: "no-store" },
    );
    const phase = data.phase;
    if (
      phase !== "frozen" &&
      phase !== "settled" &&
      phase !== "consumed" &&
      phase !== "released" &&
      phase !== "none" &&
      phase !== "pending"
    ) {
      return null;
    }
    const credits = typeof data.credits === "number" && Number.isFinite(data.credits)
      ? data.credits
      : 0;
    return { phase, credits };
  } catch {
    return null;
  }
}

export function scheduleEcomCreditsSettlementWatch(logIds: string[]) {
  if (typeof window === "undefined") return;
  const ids = [...new Set(logIds.map((id) => id.trim()).filter((id) => id.length > 8))];
  if (ids.length === 0) return;
  const key = ids.slice().sort().join(",");
  if (watching.has(key)) return;
  watching.add(key);
  void (async () => {
    let announcedFreeze = false;
    for (const delay of DELAYS_MS) {
      await sleep(delay);
      const snaps = await Promise.all(ids.map((id) => fetchSettlement(id)));
      const known = snaps.filter((snap): snap is NonNullable<typeof snap> => snap != null);
      if (known.length === 0) continue;
      const waiting = known.some((snap) => snap.phase === "pending" || snap.phase === "frozen");
      const frozenCredits = known
        .filter((snap) => snap.phase === "frozen")
        .reduce((sum, snap) => sum + snap.credits, 0);
      if (frozenCredits > 0 && !announcedFreeze) {
        announcedFreeze = true;
        emit({ logId: key, phase: "frozen", credits: frozenCredits });
      }
      if (waiting || known.length < ids.length) continue;

      const charged = known.filter(
        (snap) => snap.phase === "settled" || snap.phase === "consumed",
      );
      const released = known.filter((snap) => snap.phase === "released");
      if (charged.length > 0) {
        const phase = charged.some((snap) => snap.phase === "settled") ? "settled" : "consumed";
        emit({
          logId: key,
          phase,
          credits: charged.reduce((sum, snap) => sum + snap.credits, 0),
        });
      }
      if (released.length > 0) {
        emit({
          logId: `${key}:release`,
          phase: "released",
          credits: released.reduce((sum, snap) => sum + snap.credits, 0),
        });
      }
      if (charged.length === 0 && released.length === 0) {
        dispatchEcomCreditsBalanceRefresh();
      }
      return;
    }
    dispatchEcomCreditsBalanceRefresh();
  })();
}

/** 生成接口返回后：立刻刷新余额，并对 Gateway log 跟踪冻结 / 实扣 / 释放。 */
export function noteEcomBookResponseForCredits(
  path: string,
  method: string | undefined,
  data: Record<string, unknown>,
) {
  if (path.includes("/credits/settlement")) return;
  const m = (method ?? "GET").toUpperCase();
  const ids = m === "POST" || m === "PUT" ? collectEcomGatewayLogIds(data) : [];
  if (shouldRefreshBalance(path, method) || ids.length > 0) {
    dispatchEcomCreditsBalanceRefresh();
  }
  scheduleEcomCreditsSettlementWatch(ids);
}

/** 流式生成（拉片 / 拆解 / 助手）从响应头带回 Gateway log。 */
export function noteEcomStreamResponseForCredits(path: string, res: Response) {
  const raw = res.headers.get(ECOM_GATEWAY_LOG_HEADER) ?? "";
  const logIds = raw.split(",").map((id) => id.trim()).filter((id) => id.length > 8);
  if (logIds.length === 0) return;
  noteEcomBookResponseForCredits(path, "POST", { logIds });
}
