"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type RunSummary = {
  csvRowCount: number;
  importedCloudLines: number;
  skippedExistingCloudLines: number;
  monthsCovered: string[];
  boundUsers: number;
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
  matchKind: "BOTH" | "INTERNAL_ONLY" | "CLOUD_ONLY" | "UNBOUND";
};

type RunResult = {
  runId: string;
  summary: RunSummary;
  lines: RunLine[];
};

type RecentRun = {
  id: string;
  csvFilename: string;
  monthsCovered: string;
  status: string;
  createdAt: string;
  summary: unknown;
};

type Binding = {
  id: string;
  cloudAccountId: string;
  cloudAccountName: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
};

type UserOption = { id: string; name: string | null; email: string | null };

function fmtYuan(n: number): string {
  return `¥${n.toFixed(2)}`;
}

function verdictText(v: RunSummary["verdict"]): { label: string; tone: string } {
  if (v === "PLATFORM_OK") return { label: "平台未亏", tone: "text-green-700 bg-green-50 border-green-200" };
  if (v === "PLATFORM_DEFICIT") return { label: "亏损存在", tone: "text-red-700 bg-red-50 border-red-200" };
  return { label: "存在未绑定账号", tone: "text-amber-700 bg-amber-50 border-amber-200" };
}

function userLabel(u: UserOption | Binding): string {
  const name = "userName" in u ? u.userName : u.name;
  const email = "userEmail" in u ? u.userEmail : u.email;
  const id = "userId" in u ? u.userId : u.id;
  return [name, email, id].filter((x): x is string => !!x && x.length > 0).join(" · ");
}

export function ReconciliationClient({
  recentRuns,
  bindings,
  users,
}: {
  recentRuns: RecentRun[];
  bindings: Binding[];
  users: UserOption[];
}) {
  const [bindingState, setBindingState] = useState<Binding[]>(bindings);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  async function uploadCsv() {
    if (!file) {
      setError("请先选择 CSV 文件");
      return;
    }
    setError(null);
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("csv", file);
      const res = await fetch("/api/admin/finance/reconciliation/run", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      setResult(json as RunResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function bindAccount(cloudAccountId: string, cloudAccountName: string | null) {
    const choices = users.map((u) => `${u.id} · ${u.name || ""} · ${u.email || ""}`).join("\n");
    const picked = window.prompt(
      `请输入要绑定到的平台 User.id（云账号 ${cloudAccountId}${cloudAccountName ? ` / ${cloudAccountName}` : ""}）。\n可选用户：\n${choices}`,
    );
    if (!picked) return;
    const trimmed = picked.trim();
    if (!trimmed) return;
    const found = userMap.get(trimmed);
    if (!found) {
      alert("未找到该 User.id");
      return;
    }
    const res = await fetch("/api/admin/finance/reconciliation/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cloudAccountId,
        userId: trimmed,
        cloudAccountName,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "绑定失败");
      return;
    }
    setBindingState((prev) => {
      const without = prev.filter((b) => b.cloudAccountId !== cloudAccountId);
      return [
        {
          id: json.binding.id,
          cloudAccountId,
          cloudAccountName,
          userId: trimmed,
          userName: found.name,
          userEmail: found.email,
        },
        ...without,
      ];
    });
    alert(`绑定成功：${cloudAccountId} → ${trimmed}\n请重新上传同一 CSV 以让对账重新匹配。`);
  }

  async function clawbackForUser(userId: string) {
    if (!result) return;
    const userLines = result.lines.filter((l) => l.userId === userId);
    let deficit = 0;
    for (const l of userLines) {
      if (l.diffYuan < 0) deficit += -l.diffYuan;
    }
    if (deficit <= 0) {
      alert("该用户在本批次内未亏损，无需补扣");
      return;
    }
    const requiredPoints = Math.round(deficit * 100);

    // 第一次确认：说明对象
    const u = userMap.get(userId);
    if (!window.confirm(
      `第一次确认：将对用户「${u ? userLabel(u) : userId}」按差额 ¥${deficit.toFixed(2)} 补扣 ${requiredPoints} 点。继续？`,
    )) return;
    // 第二次确认：明确不可恢复 + 钱包扣减
    if (!window.confirm(
      `第二次确认（不可撤销）：本次补扣会立即从该用户钱包扣减点数，并写入 WalletEntry。\n金额：${requiredPoints} 点（约 ¥${deficit.toFixed(2)}）。\n确定执行吗？`,
    )) return;

    try {
      const res = await fetch(
        `/api/admin/finance/reconciliation/${result.runId}/clawback`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId,
            expectAmountPoints: requiredPoints,
            secondConfirm: true,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "补扣失败");
        return;
      }
      if (json.duplicate) {
        alert(`该用户在本批次已被补扣过（entry=${json.entryId}）`);
      } else {
        alert(
          `补扣成功：实扣 ${json.clawedPoints} 点；欠 ${json.owedPoints} 点；扣后余额 ${json.balancePoints} 点。\nWalletEntry=${json.entryId}`,
        );
      }
      // 标记本次结果中相应行已扣
      setResult((prev) =>
        prev
          ? {
              ...prev,
              lines: prev.lines.map((l) =>
                l.userId === userId ? { ...l, diffYuan: 0, matchKind: "BOTH" } : l,
              ),
            }
          : prev,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  const linesByUser = useMemo(() => {
    if (!result) return [] as Array<{ userId: string | null; cloudAccountId: string | null; lines: RunLine[]; deficitYuan: number }>;
    const map = new Map<string, { userId: string | null; cloudAccountId: string | null; lines: RunLine[]; deficitYuan: number }>();
    for (const l of result.lines) {
      const k = `${l.userId ?? "_unbound"}::${l.cloudAccountId ?? ""}`;
      const ex = map.get(k) ?? {
        userId: l.userId,
        cloudAccountId: l.cloudAccountId,
        lines: [] as RunLine[],
        deficitYuan: 0,
      };
      ex.lines.push(l);
      if (l.diffYuan < 0) ex.deficitYuan += -l.diffYuan;
      map.set(k, ex);
    }
    return Array.from(map.values()).sort((a, b) => b.deficitYuan - a.deficitYuan || (a.userId ?? "").localeCompare(b.userId ?? ""));
  }, [result]);

  return (
    <div className="space-y-6">
      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-base font-medium">① 上传云厂商账单 CSV</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          目前支持阿里云 `consumedetailbillv2` 导出（表头需含 `标识信息/账单明细ID`）。同一 SHA-256 的文件已上传过则返回原批次。
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <Button type="button" onClick={uploadCsv} disabled={uploading || !file}>
            {uploading ? "处理中…" : "上传并对账"}
          </Button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </section>

      {result ? (
        <section className="rounded border border-[#e8e8e8] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-base font-medium">② 对账报告</h2>
            <span
              className={`rounded border px-2 py-0.5 text-xs ${verdictText(result.summary.verdict).tone}`}
            >
              {verdictText(result.summary.verdict).label}
            </span>
            <span className="text-xs text-muted-foreground">runId={result.runId}</span>
          </div>

          <div className="mb-4 grid gap-2 text-sm md:grid-cols-3 lg:grid-cols-4">
            <Stat label="CSV 行数" value={String(result.summary.csvRowCount)} />
            <Stat label="覆盖月份" value={result.summary.monthsCovered.join(",") || "—"} />
            <Stat label="新入库云行" value={String(result.summary.importedCloudLines)} />
            <Stat label="重复跳过" value={String(result.summary.skippedExistingCloudLines)} />
            <Stat label="内部计价行" value={String(result.summary.internalLineCount)} />
            <Stat label="云应付行" value={String(result.summary.cloudLineCount)} />
            <Stat label="内部计价合计" value={fmtYuan(result.summary.internalTotalYuan)} />
            <Stat label="云应付合计" value={fmtYuan(result.summary.cloudTotalPayableYuan)} />
            <Stat
              label="差额（内部 − 云）"
              value={fmtYuan(result.summary.diffYuanInternalMinusCloud)}
              tone={result.summary.diffYuanInternalMinusCloud < 0 ? "text-red-600" : "text-green-700"}
            />
          </div>

          {result.summary.unboundCloudAccounts.length > 0 ? (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="mb-1 font-medium text-amber-800">未绑定云账号：</div>
              <ul className="space-y-1">
                {result.summary.unboundCloudAccounts.map((u) => (
                  <li key={u.cloudAccountId} className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-white px-1 py-0.5 text-xs">{u.cloudAccountId}</code>
                    {u.cloudAccountName ? <span className="text-amber-900">{u.cloudAccountName}</span> : null}
                    <span className="text-amber-800">{u.csvRowCount} 行 / {fmtYuan(u.payableYuanSum)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => bindAccount(u.cloudAccountId, u.cloudAccountName)}
                    >
                      绑定到用户…
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700">绑定后请再次上传同一 CSV，让对账重新匹配（同 SHA-256 会复用 runId）。</p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#fafafa]">
                  <th className="border border-[#e8e8e8] px-2 py-2 text-left font-medium">用户</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-left font-medium">模型 / 计费维度</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-right font-medium">内部行数</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-right font-medium">内部合计</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-right font-medium">云行数</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-right font-medium">云应付</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-right font-medium">差额</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-center font-medium">命中</th>
                  <th className="border border-[#e8e8e8] px-2 py-2 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {linesByUser.flatMap((group) => {
                  const headerRow = (
                    <tr key={`hdr-${group.userId ?? "ub"}-${group.cloudAccountId ?? ""}`} className="bg-[#f5f5f5]">
                      <td className="border border-[#e8e8e8] px-2 py-1.5 font-medium" colSpan={6}>
                        {group.userId
                          ? userLabel(userMap.get(group.userId) ?? { id: group.userId, name: null, email: null })
                          : `未绑定 · cloudAccountId=${group.cloudAccountId}`}
                      </td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-right">
                        <span className={group.deficitYuan > 0 ? "text-red-600" : "text-green-700"}>
                          {group.deficitYuan > 0 ? `-${fmtYuan(group.deficitYuan)}` : "—"}
                        </span>
                      </td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-center">—</td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-center">
                        {group.userId && group.deficitYuan > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => clawbackForUser(group.userId!)}
                          >
                            补扣 {Math.round(group.deficitYuan * 100)} 点
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                  const rows = group.lines.map((l, i) => (
                    <tr key={`${group.userId ?? "ub"}-${i}`} className="bg-white hover:bg-[#fafafa]">
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-muted-foreground">↳</td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5">
                        <code className="text-xs">{l.modelKey}</code>
                        <span className="ml-2 text-xs text-muted-foreground">{l.billingKind}</span>
                      </td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-right">{l.internalCount}</td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-right">{fmtYuan(l.internalYuan)}</td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-right">{l.cloudCount}</td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-right">{fmtYuan(l.cloudPayableYuan)}</td>
                      <td className={`border border-[#e8e8e8] px-2 py-1.5 text-right ${l.diffYuan < 0 ? "text-red-600" : "text-green-700"}`}>
                        {fmtYuan(l.diffYuan)}
                      </td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-center text-xs">{l.matchKind}</td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5"></td>
                    </tr>
                  ));
                  return [headerRow, ...rows];
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-base font-medium">③ 历史对账批次</h2>
        {recentRuns.length === 0 ? (
          <div className="text-sm text-muted-foreground">暂无对账批次。上传 CSV 后会在这里出现。</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentRuns.map((r) => {
              const s = r.summary as RunSummary | null;
              const v = s ? verdictText(s.verdict) : { label: r.status, tone: "" };
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded border border-[#f0f0f0] px-3 py-2"
                >
                  <code className="text-xs text-muted-foreground">{r.id}</code>
                  <span>{r.csvFilename}</span>
                  <span className="text-xs text-muted-foreground">{r.monthsCovered}</span>
                  <span className={`rounded border px-2 py-0.5 text-xs ${v.tone}`}>{v.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {s ? `内 ${fmtYuan(s.internalTotalYuan)} / 云 ${fmtYuan(s.cloudTotalPayableYuan)} / 差 ${fmtYuan(s.diffYuanInternalMinusCloud)}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-3 text-base font-medium">④ 已有云账号绑定</h2>
        {bindingState.length === 0 ? (
          <div className="text-sm text-muted-foreground">无绑定。上传 CSV 时遇到未绑定账号会提示在报告里绑定。</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {bindingState.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-[#f5f5f5] px-1 py-0.5 text-xs">{b.cloudAccountId}</code>
                {b.cloudAccountName ? <span className="text-muted-foreground">{b.cloudAccountName}</span> : null}
                <span>→</span>
                <span>{userLabel(b)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-[#f0f0f0] px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-medium ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
