"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import { financeApiFetch } from "@/lib/finance-viewer";
import { formatUserCellPrimary, formatUserOptionLabel } from "@/lib/user-contact-display";

type RunSummary = {
  csvRowCount: number;
  importedCloudLines: number;
  skippedExistingCloudLines: number;
  monthsCovered: string[];
  unboundCloudAccounts: Array<{
    cloudAccountId: string;
    cloudAccountName: string | null;
    csvRowCount: number;
    payableYuanSum: number;
  }>;
  internalLineCount: number;
  cloudLineCount: number;
  internalTotalYuan: number;
  cloudTotalPayableYuan: number;
  diffYuanInternalMinusCloud: number;
  verdict: "PLATFORM_OK" | "PLATFORM_DEFICIT" | "MIXED";
};

type RunLine = {
  userId: string | null;
  cloudAccountId: string | null;
  modelKey: string;
  billingKind: string;
  internalCount: number;
  internalYuan: number;
  cloudCount: number;
  cloudPayableYuan: number;
  diffYuan: number;
  matchKind: string;
};

type RunResult = { runId: string; summary: RunSummary; lines: RunLine[] };

type Binding = {
  id: string;
  cloudAccountId: string;
  cloudAccountName: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
};

type UserOption = { id: string; name: string | null; email: string | null; phone: string | null };

function fmtYuan(n: number) {
  return `¥${n.toFixed(2)}`;
}

export function ReconciliationClient() {
  const base = useBookMallBaseUrl();
  const [recentRuns, setRecentRuns] = useState<Array<{ id: string; csvFilename: string; status: string; createdAt: string }>>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bindModal, setBindModal] = useState<{ cloudAccountId: string; cloudAccountName: string | null } | null>(null);
  const [bindUserId, setBindUserId] = useState("");
  const [clawbackModal, setClawbackModal] = useState<{ userId: string; points: number; deficit: number; step: 1 | 2 } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const reload = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<{
      recentRuns: Array<{ id: string; csvFilename: string; status: string; createdAt: string }>;
      bindings: Binding[];
      users: UserOption[];
    }>(base, "/api/finance/admin/reconciliation");
    if (r.ok) {
      setRecentRuns(r.data.recentRuns);
      setBindings(r.data.bindings);
      setUsers(r.data.users);
    }
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function uploadCsv() {
    if (!base || !file) {
      setError("请先选择 CSV");
      return;
    }
    setError(null);
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("csv", file);
      const { url, init } = resolveBookMallBrowserRequest(base, "/api/admin/finance/reconciliation/run", {
        method: "POST",
        body: form,
      });
      const res = await fetch(url, init);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      setResult(json as RunResult);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function submitBind() {
    if (!base || !bindModal || !bindUserId.trim()) return;
    const { url, init } = resolveBookMallBrowserRequest(base, "/api/admin/finance/reconciliation/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cloudAccountId: bindModal.cloudAccountId,
        userId: bindUserId.trim(),
        cloudAccountName: bindModal.cloudAccountName,
      }),
    });
    const res = await fetch(url, init);
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error || "绑定失败");
      return;
    }
    setBindModal(null);
    setBindUserId("");
    setMsg("绑定成功，请重新上传同一 CSV");
    reload();
  }

  async function submitClawback() {
    if (!base || !result || !clawbackModal || clawbackModal.step === 1) return;
    const { url, init } = resolveBookMallBrowserRequest(
      base,
      `/api/admin/finance/reconciliation/${result.runId}/clawback`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: clawbackModal.userId,
          expectAmountPoints: clawbackModal.points,
          secondConfirm: true,
        }),
      },
    );
    const res = await fetch(url, init);
    const json = await res.json();
    setClawbackModal(null);
    if (!res.ok) {
      setMsg(json.error || "补扣失败");
      return;
    }
    setMsg(`补扣成功：实扣 ${json.clawedPoints} 点`);
    setResult((prev) =>
      prev
        ? {
            ...prev,
            lines: prev.lines.map((l) =>
              l.userId === clawbackModal.userId ? { ...l, diffYuan: 0, matchKind: "BOTH" } : l,
            ),
          }
        : prev,
    );
  }

  const linesByUser = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, { userId: string | null; deficitYuan: number; lines: RunLine[] }>();
    for (const l of result.lines) {
      const k = l.userId ?? "_ub";
      const ex = map.get(k) ?? { userId: l.userId, deficitYuan: 0, lines: [] };
      ex.lines.push(l);
      if (l.diffYuan < 0) ex.deficitYuan += -l.diffYuan;
      map.set(k, ex);
    }
    return Array.from(map.values()).sort((a, b) => b.deficitYuan - a.deficitYuan);
  }, [result]);

  return (
    <div className="flex w-full flex-col gap-4">
      <header>
        <h1 className="text-lg font-medium">云账单对账</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">仅财务管理员可见。上传阿里云 consumedetailbillv2 CSV 并对账。</p>
      </header>
      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">上传 CSV</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <button
            type="button"
            onClick={uploadCsv}
            disabled={uploading || !file}
            className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {uploading ? "处理中…" : "上传并对账"}
          </button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </section>

      {result ? (
        <section className="rounded border border-[#e8e8e8] bg-white p-4">
          <h2 className="mb-2 text-sm font-medium">对账报告 · {result.runId}</h2>
          <p className="mb-3 text-sm">
            内部 {fmtYuan(result.summary.internalTotalYuan)} · 云 {fmtYuan(result.summary.cloudTotalPayableYuan)} · 差额{" "}
            <span className={result.summary.diffYuanInternalMinusCloud < 0 ? "text-red-600" : "text-green-700"}>
              {fmtYuan(result.summary.diffYuanInternalMinusCloud)}
            </span>
          </p>
          {result.summary.unboundCloudAccounts.length > 0 ? (
            <ul className="mb-3 space-y-1 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              {result.summary.unboundCloudAccounts.map((u) => (
                <li key={u.cloudAccountId} className="flex flex-wrap items-center gap-2">
                  <code>{u.cloudAccountId}</code>
                  <button
                    type="button"
                    className="text-[#1890ff] hover:underline"
                    onClick={() => setBindModal({ cloudAccountId: u.cloudAccountId, cloudAccountName: u.cloudAccountName })}
                  >
                    绑定用户
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#fafafa]">
                <tr>
                  <th className="px-2 py-2 text-left">用户</th>
                  <th className="px-2 py-2 text-right">亏损</th>
                  <th className="px-2 py-2 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {linesByUser.map((g) => {
                  const u = g.userId ? userMap.get(g.userId) : null;
                  return (
                    <tr key={g.userId ?? "ub"} className="border-t">
                      <td className="px-2 py-2">
                        {u ? formatUserCellPrimary(u) : "未绑定"}
                      </td>
                      <td className="px-2 py-2 text-right text-red-600">
                        {g.deficitYuan > 0 ? fmtYuan(g.deficitYuan) : "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {g.userId && g.deficitYuan > 0 ? (
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() =>
                              setClawbackModal({
                                userId: g.userId!,
                                points: Math.round(g.deficitYuan * 100),
                                deficit: g.deficitYuan,
                                step: 1,
                              })
                            }
                          >
                            补扣 {Math.round(g.deficitYuan * 100)} 点
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">历史批次（{recentRuns.length}）</h2>
        <ul className="text-sm text-[#8c8c8c]">
          {recentRuns.map((r) => (
            <li key={r.id}>
              {r.createdAt.slice(0, 10)} · {r.csvFilename} · {r.status}
            </li>
          ))}
        </ul>
        <h2 className="mb-2 mt-4 text-sm font-medium">云账号绑定（{bindings.length}）</h2>
        <ul className="text-xs">
          {bindings.slice(0, 10).map((b) => (
            <li key={b.id}>
              {b.cloudAccountId} → {formatUserCellPrimary({ name: b.userName, email: b.userEmail, phone: b.userPhone, id: b.userId })}
            </li>
          ))}
        </ul>
      </section>

      {bindModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="max-w-md rounded bg-white p-4 shadow">
            <p className="text-sm">绑定云账号 {bindModal.cloudAccountId} 到用户 ID：</p>
            <select className="mt-2 w-full rounded border px-2 py-1.5 text-sm" value={bindUserId} onChange={(e) => setBindUserId(e.target.value)}>
              <option value="">选择用户</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUserOptionLabel(u)}
                </option>
              ))}
            </select>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setBindModal(null)}>
                取消
              </button>
              <button type="button" className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white" onClick={submitBind}>
                确认绑定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clawbackModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="max-w-md rounded bg-white p-4 shadow">
            {clawbackModal.step === 1 ? (
              <>
                <p className="text-sm">
                  第一次确认：将对用户补扣 {clawbackModal.points} 点（约 ¥{clawbackModal.deficit.toFixed(2)}）。
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setClawbackModal(null)}>
                    取消
                  </button>
                  <button
                    type="button"
                    className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white"
                    onClick={() => setClawbackModal({ ...clawbackModal, step: 2 })}
                  >
                    继续
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-red-600">
                  第二次确认（不可撤销）：将立即从钱包扣减 {clawbackModal.points} 点并写入 WalletEntry。
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setClawbackModal(null)}>
                    取消
                  </button>
                  <button type="button" className="rounded bg-red-600 px-3 py-1.5 text-sm text-white" onClick={submitClawback}>
                    确认补扣
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
