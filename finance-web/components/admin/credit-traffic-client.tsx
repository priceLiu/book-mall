"use client";

import { useCallback, useEffect, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";

type Disposition = "in_flight" | "release" | "settle_frozen" | "stale_running" | "closed";

type Item = {
  logId: string;
  ownerType: string;
  ownerId: string;
  reservedCredits: number;
  ageMs: number;
  logStatus: string | null;
  requestKind: string | null;
  model: string | null;
  disposition: Disposition;
};

type Snapshot = {
  now: string;
  pool: {
    enabled: boolean;
    connectionLimit: number;
    inFlight: number;
    waitQueue: number;
    circuitOpen: boolean;
    poolTimeoutsInWindow: number;
  };
  counts: Record<Disposition, number>;
  items: Item[];
};

const LABEL: Record<Disposition, string> = {
  in_flight: "在途",
  release: "应释放",
  settle_frozen: "应补结算",
  stale_running: "超时仍在跑",
  closed: "已关闭",
};

function minutes(ageMs: number) {
  return Math.max(0, Math.round(ageMs / 60000));
}

export function CreditTrafficClient() {
  const base = useBookMallBaseUrl();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [ownerType, setOwnerType] = useState<"USER" | "TENANT">("USER");
  const [ownerId, setOwnerId] = useState("");
  const [credits, setCredits] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const r = await financeApiFetch<Snapshot>(base, "/api/finance/admin/credit-traffic");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setSnap(r.data);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setNote(null);
    const r = await financeApiPost<{ result?: { released?: number; settled?: number; errors?: string[] }; error?: string }>(
      base,
      "/api/finance/admin/credit-traffic",
      body,
    );
    setBusy(false);
    if (!r.ok) {
      setNote(r.error);
      return;
    }
    if (r.data.error) {
      setNote(r.data.error);
      return;
    }
    const result = r.data.result;
    const extra =
      result && "released" in result
        ? `释放 ${result.released ?? 0}，补结 ${result.settled ?? 0}${result.errors?.length ? `，失败 ${result.errors.length}` : ""}`
        : done;
    setNote(extra);
    await load();
  }

  if (!snap && !error) {
    return (
      <FinancePageShell>
        <FinancePageState>正在读取积分在途…</FinancePageState>
      </FinancePageShell>
    );
  }

  return (
    <FinancePageShell>
      <div>
        <h1 className="text-xl font-semibold">积分疏通台</h1>
        <p className="mt-1 text-sm text-neutral-500">
          查看冻结未释放、成功未结算和超时仍在跑的任务。自动疏通只处理失败释放和成功补结；超时在途需单独放行，放行后若任务最终成功会改按实扣。
        </p>
      </div>
      {error ? <FinancePageState variant="error">{error}</FinancePageState> : null}
      {note ? <p className="text-sm text-neutral-700">{note}</p> : null}
      {snap ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(Object.keys(LABEL) as Disposition[]).map((key) => (
              <div key={key} className="rounded-lg border border-neutral-200 px-3 py-2">
                <div className="text-xs text-neutral-500">{LABEL[key]}</div>
                <div className="text-lg font-semibold">{snap.counts[key] ?? 0}</div>
              </div>
            ))}
            <div className="rounded-lg border border-neutral-200 px-3 py-2">
              <div className="text-xs text-neutral-500">连接池</div>
              <div className="text-sm">
                {snap.pool.enabled ? "闸门开" : "闸门关"} · 上限 {snap.pool.connectionLimit} · 在用{" "}
                {snap.pool.inFlight} · 排队 {snap.pool.waitQueue}
                {snap.pool.circuitOpen ? " · 熔断中" : ""}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border px-3 py-1.5 text-sm" disabled={busy} onClick={() => void load()}>
              刷新
            </button>
            <button
              type="button"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void run({ action: "sweep" }, "已疏通")}
            >
              自动疏通
            </button>
            <button
              type="button"
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => void run({ action: "sweep", releaseStaleRunning: true }, "已含超时放行")}
            >
              自动疏通并释放超时在途
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">日志</th>
                  <th className="px-3 py-2">冻结</th>
                  <th className="px-3 py-2">已等待</th>
                  <th className="px-3 py-2">账户</th>
                  <th className="px-3 py-2">处理</th>
                </tr>
              </thead>
              <tbody>
                {snap.items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-neutral-500" colSpan={6}>
                      没有未关闭的冻结。
                    </td>
                  </tr>
                ) : (
                  snap.items.map((item) => (
                    <tr key={item.logId} className="border-t border-neutral-100">
                      <td className="px-3 py-2">
                        {LABEL[item.disposition]}
                        <div className="text-xs text-neutral-400">{item.logStatus ?? "无日志"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs">{item.logId}</div>
                        <div className="text-xs text-neutral-500">
                          {item.requestKind ?? "—"} {item.model ?? ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">{item.reservedCredits}</td>
                      <td className="px-3 py-2">{minutes(item.ageMs)} 分钟</td>
                      <td className="px-3 py-2 text-xs">
                        {item.ownerType}:{item.ownerId}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="mr-2 text-xs underline"
                          disabled={busy}
                          onClick={() => void run({ action: "release", logId: item.logId }, "已释放")}
                        >
                          释放
                        </button>
                        <button
                          type="button"
                          className="text-xs underline"
                          disabled={busy}
                          onClick={() => void run({ action: "settle", logId: item.logId }, "已补结")}
                        >
                          补结算
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <form
            className="grid max-w-xl gap-2 rounded-lg border border-neutral-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(credits);
              if (!ownerId.trim() || !reason.trim() || !Number.isFinite(amount) || amount === 0) {
                setNote("校正需要账户、非零积分和原因");
                return;
              }
              void run(
                {
                  action: "adjust",
                  ownerType,
                  ownerId: ownerId.trim(),
                  credits: amount,
                  reason: reason.trim(),
                  idempotencyKey: `adjust:traffic:${ownerType}:${ownerId.trim()}:${amount}:${reason.trim()}`,
                },
                "已校正",
              );
            }}
          >
            <div className="text-sm font-medium">人工校正</div>
            <p className="text-xs text-neutral-500">正数加回，负数扣减。同一账户、金额和原因只会生效一次。</p>
            <div className="flex gap-2">
              <select
                className="rounded border px-2 py-1 text-sm"
                value={ownerType}
                onChange={(e) => setOwnerType(e.target.value as "USER" | "TENANT")}
              >
                <option value="USER">个人</option>
                <option value="TENANT">团队</option>
              </select>
              <input
                className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                placeholder="账户 ownerId"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              />
              <input
                className="w-24 rounded border px-2 py-1 text-sm"
                placeholder="积分"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </div>
            <input
              className="rounded border px-2 py-1 text-sm"
              placeholder="原因"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="submit" className="w-fit rounded-md border px-3 py-1.5 text-sm" disabled={busy}>
              提交校正
            </button>
          </form>
        </>
      ) : null}
    </FinancePageShell>
  );
}
