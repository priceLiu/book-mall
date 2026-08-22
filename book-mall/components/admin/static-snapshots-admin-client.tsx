"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { StaticSnapshotStatus, StaticSnapshotTrigger } from "@prisma/client";

import {
  isSiteHomeSnapshotPayload,
  summarizeSiteHomePayload,
} from "@/lib/static-snapshots/site-home-payload";

const STATUS_LABEL: Record<StaticSnapshotStatus, string> = {
  READY: "成功",
  FAILED: "失败",
};

const TRIGGER_LABEL: Record<StaticSnapshotTrigger, string> = {
  CRON: "定时任务",
  ADMIN: "管理后台",
  CLI: "CLI",
};

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleString("zh-CN");
}

type RunRow = {
  id: string;
  pageKey: string;
  dateKey: string;
  status: StaticSnapshotStatus;
  trigger: StaticSnapshotTrigger;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  summary: unknown;
};

type SnapshotInfo = {
  pageKey: string;
  dateKey: string;
  status: StaticSnapshotStatus;
  generatedAt: string;
  errorMessage: string | null;
  summary: {
    platformAppCount: number;
    showcaseItemCount: number;
    gatewayModelCount: number;
    heroClipCount: number;
  } | null;
};

export function StaticSnapshotsAdminClient({
  pageKey,
  latestSnapshot,
  initialRuns,
}: {
  pageKey: string;
  latestSnapshot: SnapshotInfo | null;
  initialRuns: RunRow[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const onGenerate = async () => {
    setGenerating(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/static-snapshots/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "生成失败");
      }
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1f2328]">静态资源管理</h1>
        <p className="mt-2 text-sm text-[#656d76]">
          首页等大流量页由 Cron / 手动预生成快照，用户访问只读 DB 或 ISR 缓存，不实时查库。
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-[#d1d9e0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1f2328]">首页快照（site-home）</h2>
            <p className="mt-0.5 text-sm text-[#656d76]">
              含 Hero、平台应用 showcase、Gateway 模型市场；Cron 建议每日 05:30 CST
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0969da] px-4 py-2 text-sm font-medium text-white hover:bg-[#0550ae] disabled:opacity-60"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : null}
            {generating ? "正在生成…" : "立即生成首页快照"}
          </button>
        </div>

        {actionError ? (
          <p className="rounded-lg border border-[#ff818266] bg-[#ffebe9] px-3 py-2 text-sm text-[#cf222e]">
            {actionError}
          </p>
        ) : null}

        {latestSnapshot ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[#656d76]">业务日</dt>
              <dd className="font-medium tabular-nums text-[#1f2328]">{latestSnapshot.dateKey}</dd>
            </div>
            <div>
              <dt className="text-[#656d76]">状态</dt>
              <dd className="font-medium text-[#1f2328]">
                {STATUS_LABEL[latestSnapshot.status]}
              </dd>
            </div>
            <div>
              <dt className="text-[#656d76]">生成时间</dt>
              <dd className="font-medium text-[#1f2328]">{fmtTime(latestSnapshot.generatedAt)}</dd>
            </div>
            <div>
              <dt className="text-[#656d76]">摘要</dt>
              <dd className="font-medium tabular-nums text-[#1f2328]">
                {latestSnapshot.summary
                  ? `${latestSnapshot.summary.platformAppCount} 应用 · ${latestSnapshot.summary.gatewayModelCount} 模型 · ${latestSnapshot.summary.showcaseItemCount} 作品`
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-lg border border-dashed border-[#d1d9e0] px-4 py-6 text-center text-sm text-[#656d76]">
            尚无快照记录，请点击上方按钮生成（或运行 pnpm site-home:snapshot-generate）
          </p>
        )}

        {latestSnapshot?.errorMessage ? (
          <p className="text-sm text-[#cf222e]">{latestSnapshot.errorMessage}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#1f2328]">生成记录</h2>
        {initialRuns.length === 0 ? (
          <p className="text-sm text-[#656d76]">暂无生成流水</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#d1d9e0] bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#f6f8fa] text-left text-xs text-[#656d76]">
                <tr>
                  <th className="px-3 py-2 font-medium">开始时间</th>
                  <th className="px-3 py-2 font-medium">业务日</th>
                  <th className="px-3 py-2 font-medium">触发</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 text-right font-medium">耗时</th>
                  <th className="px-3 py-2 font-medium">摘要 / 错误</th>
                </tr>
              </thead>
              <tbody>
                {initialRuns.map((r) => {
                  const summary = r.summary as {
                    platformAppCount?: number;
                    gatewayModelCount?: number;
                  } | null;
                  return (
                    <tr key={r.id} className="border-t border-[#eaeef2]">
                      <td className="whitespace-nowrap px-3 py-2 text-[#656d76]">
                        {fmtTime(r.startedAt)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.dateKey}</td>
                      <td className="px-3 py-2">{TRIGGER_LABEL[r.trigger]}</td>
                      <td className="px-3 py-2">{STATUS_LABEL[r.status]}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#656d76]">
                        {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-[#656d76]">
                        {r.status === "READY" && summary
                          ? `${summary.platformAppCount ?? "—"} 应用 · ${summary.gatewayModelCount ?? "—"} 模型`
                          : (r.errorMessage ?? "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function snapshotInfoFromRow(row: {
  pageKey: string;
  dateKey: string;
  status: StaticSnapshotStatus;
  generatedAt: Date;
  errorMessage: string | null;
  payload: unknown;
}): SnapshotInfo {
  const payload = isSiteHomeSnapshotPayload(row.payload) ? row.payload : null;
  return {
    pageKey: row.pageKey,
    dateKey: row.dateKey,
    status: row.status,
    generatedAt: row.generatedAt.toISOString(),
    errorMessage: row.errorMessage,
    summary: payload ? summarizeSiteHomePayload(payload) : null,
  };
}
