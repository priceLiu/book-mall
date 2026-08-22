"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { StaticSnapshotStatus, StaticSnapshotTrigger } from "@prisma/client";

import {
  isCanvasHomeSnapshotPayload,
  summarizeCanvasHomePayload,
  CANVAS_HOME_PAGE_KEY,
} from "@/lib/static-snapshots/canvas-home-payload";
import {
  isSiteHomeSnapshotPayload,
  summarizeSiteHomePayload,
  SITE_HOME_PAGE_KEY,
} from "@/lib/static-snapshots/site-home-payload";
import type { StaticSnapshotPageKey } from "@/lib/static-snapshots/static-snapshot-run";

const STATUS_LABEL: Record<StaticSnapshotStatus, string> = {
  READY: "成功",
  FAILED: "失败",
};

const TRIGGER_LABEL: Record<StaticSnapshotTrigger, string> = {
  CRON: "定时任务",
  ADMIN: "管理后台",
  CLI: "CLI",
};

const PAGE_TABS: {
  pageKey: StaticSnapshotPageKey;
  title: string;
  description: string;
  generateLabel: string;
  emptyHint: string;
}[] = [
  {
    pageKey: SITE_HOME_PAGE_KEY,
    title: "主站首页（site-home）",
    description: "Hero、平台应用 showcase、Gateway 模型市场",
    generateLabel: "立即生成主站首页快照",
    emptyHint: "尚无快照，请点击生成或运行 pnpm site-home:snapshot-generate",
  },
  {
    pageKey: CANVAS_HOME_PAGE_KEY,
    title: "画布首页（canvas-home）",
    description: "精选 / 模板 / 案例 / 分镜视频作品墙",
    generateLabel: "立即生成画布首页快照",
    emptyHint: "尚无快照，请点击生成或运行 pnpm canvas-home:snapshot-generate",
  },
];

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

export type SnapshotInfo = {
  pageKey: string;
  dateKey: string;
  status: StaticSnapshotStatus;
  generatedAt: string;
  errorMessage: string | null;
  summaryText: string | null;
};

function summaryTextFromPayload(pageKey: string, payload: unknown): string | null {
  if (pageKey === SITE_HOME_PAGE_KEY && isSiteHomeSnapshotPayload(payload)) {
    const s = summarizeSiteHomePayload(payload);
    return `${s.platformAppCount} 应用 · ${s.gatewayModelCount} 模型 · ${s.showcaseItemCount} 作品`;
  }
  if (pageKey === CANVAS_HOME_PAGE_KEY && isCanvasHomeSnapshotPayload(payload)) {
    const s = summarizeCanvasHomePayload(payload);
    return `${s.featuredCount} 精选 · ${s.templateCount} 模板 · ${s.caseCount} 案例 · ${s.filmShowcaseCount} 视频`;
  }
  return null;
}

function runSummaryText(pageKey: string, summary: unknown): string {
  if (pageKey === SITE_HOME_PAGE_KEY) {
    const s = summary as { platformAppCount?: number; gatewayModelCount?: number } | null;
    return `${s?.platformAppCount ?? "—"} 应用 · ${s?.gatewayModelCount ?? "—"} 模型`;
  }
  if (pageKey === CANVAS_HOME_PAGE_KEY) {
    const s = summary as {
      featuredCount?: number;
      templateCount?: number;
      filmShowcaseCount?: number;
    } | null;
    return `${s?.featuredCount ?? "—"} 精选 · ${s?.templateCount ?? "—"} 模板 · ${s?.filmShowcaseCount ?? "—"} 视频`;
  }
  return "—";
}

export function StaticSnapshotsAdminClient({
  snapshots,
  runsByPageKey,
}: {
  snapshots: Record<StaticSnapshotPageKey, SnapshotInfo | null>;
  runsByPageKey: Record<StaticSnapshotPageKey, RunRow[]>;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StaticSnapshotPageKey>(SITE_HOME_PAGE_KEY);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tab = PAGE_TABS.find((t) => t.pageKey === activeTab)!;
  const latestSnapshot = snapshots[activeTab];
  const initialRuns = runsByPageKey[activeTab];

  const onGenerate = async () => {
    setGenerating(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/static-snapshots/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey: activeTab }),
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
          大流量页由 Cron / 手动预生成快照，用户访问只读 DB 或缓存，不实时查库。Cron 建议每日 05:30
          CST。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PAGE_TABS.map((t) => (
          <button
            key={t.pageKey}
            type="button"
            onClick={() => setActiveTab(t.pageKey)}
            className={
              activeTab === t.pageKey
                ? "rounded-lg bg-[#0969da] px-4 py-2 text-sm font-medium text-white"
                : "rounded-lg border border-[#d1d9e0] bg-white px-4 py-2 text-sm text-[#656d76] hover:bg-[#f6f8fa]"
            }
          >
            {t.title}
          </button>
        ))}
      </div>

      <section className="space-y-4 rounded-xl border border-[#d1d9e0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1f2328]">{tab.title}</h2>
            <p className="mt-0.5 text-sm text-[#656d76]">{tab.description}</p>
          </div>
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0969da] px-4 py-2 text-sm font-medium text-white hover:bg-[#0550ae] disabled:opacity-60"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : null}
            {generating ? "正在生成…" : tab.generateLabel}
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
                {latestSnapshot.summaryText ?? "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="rounded-lg border border-dashed border-[#d1d9e0] px-4 py-6 text-center text-sm text-[#656d76]">
            {tab.emptyHint}
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
                {initialRuns.map((r) => (
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
                      {r.status === "READY"
                        ? runSummaryText(activeTab, r.summary)
                        : (r.errorMessage ?? "—")}
                    </td>
                  </tr>
                ))}
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
  return {
    pageKey: row.pageKey,
    dateKey: row.dateKey,
    status: row.status,
    generatedAt: row.generatedAt.toISOString(),
    errorMessage: row.errorMessage,
    summaryText: summaryTextFromPayload(row.pageKey, row.payload),
  };
}
