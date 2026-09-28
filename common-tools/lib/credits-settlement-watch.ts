import { dispatchCommonToolsCreditsBalanceRefresh } from "@/lib/credits-balance-events";

export const COMMON_TOOLS_CREDITS_SETTLEMENT_EVENT = "common-tools:credits-settlement";

export type CommonToolsCreditsSettlementPhase =
  | "frozen"
  | "settled"
  | "consumed"
  | "released"
  | "none"
  | "pending";

export type CommonToolsCreditsSettlementDetail = {
  logId: string;
  phase: Exclude<CommonToolsCreditsSettlementPhase, "pending">;
  credits: number;
};

const watching = new Set<string>();
const DELAYS_MS = [400, 1500, 4000, 9000, 20000, 45000, 90000];

export function collectCommonToolsGatewayLogIds(data: Record<string, unknown>): string[] {
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
  return path.includes("image-processing/edit");
}

function emit(detail: CommonToolsCreditsSettlementDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(COMMON_TOOLS_CREDITS_SETTLEMENT_EVENT, { detail }),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchSettlement(logId: string): Promise<{
  phase: CommonToolsCreditsSettlementPhase;
  credits: number;
} | null> {
  const { bookFetch } = await import("@/lib/book-fetch");
  try {
    const data = await bookFetch(
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

export function scheduleCommonToolsCreditsSettlementWatch(logIds: string[]) {
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
        dispatchCommonToolsCreditsBalanceRefresh();
      }
      return;
    }
    dispatchCommonToolsCreditsBalanceRefresh();
  })();
}

/** 生成接口返回后：刷新余额，并对 Gateway log 跟踪冻结 / 实扣 / 释放。 */
export function noteCommonToolsBookResponseForCredits(
  path: string,
  method: string | undefined,
  data: Record<string, unknown>,
) {
  if (path.includes("/credits/settlement")) return;
  const m = (method ?? "GET").toUpperCase();
  const ids = m === "POST" || m === "PUT" ? collectCommonToolsGatewayLogIds(data) : [];
  if (shouldRefreshBalance(path, method) || ids.length > 0) {
    dispatchCommonToolsCreditsBalanceRefresh();
  }
  scheduleCommonToolsCreditsSettlementWatch(ids);
}
