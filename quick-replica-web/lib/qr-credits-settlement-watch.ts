import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

export const QR_CREDITS_SETTLEMENT_EVENT = "quick-replica:credits-settlement";
export const QR_CREDITS_BALANCE_REFRESH_EVENT = "platform:credits-balance-refresh";

export type QrCreditsSettlementPhase =
  | "frozen"
  | "settled"
  | "consumed"
  | "released"
  | "none"
  | "pending";

export type QrCreditsSettlementDetail = {
  logId: string;
  phase: Exclude<QrCreditsSettlementPhase, "pending">;
  credits: number;
};

const watching = new Set<string>();
const DELAYS_MS = [400, 1500, 4000, 9000, 20000, 45000, 90000];

function emit(detail: QrCreditsSettlementDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(QR_CREDITS_SETTLEMENT_EVENT, { detail }));
}

export function dispatchQrCreditsBalanceRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(QR_CREDITS_BALANCE_REFRESH_EVENT));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchSettlement(logId: string): Promise<{
  phase: QrCreditsSettlementPhase;
  credits: number;
} | null> {
  try {
    const res = await fetchQrPlatform(
      `/api/book-mall/api/sso/tools/ecom/credits/settlement?logId=${encodeURIComponent(logId)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { phase?: string; credits?: number };
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

/** 产生任务创建后跟踪冻结 / 实扣 / 释放。同一批 log 在本页只跟踪一次。 */
export function scheduleQrCreditsSettlementWatch(logIds: string[]) {
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
        dispatchQrCreditsBalanceRefresh();
      }
      return;
    }
    dispatchQrCreditsBalanceRefresh();
  })();
}
