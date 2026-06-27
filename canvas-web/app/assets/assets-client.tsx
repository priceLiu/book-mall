"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Layers } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { UnifiedProjectAssetsView } from "@/components/canvas/unified-project-assets-view";
import {
  listMyCanvasProjects,
  type CanvasProjectSummary,
} from "@/lib/canvas-api";

function Inner() {
  const base = useBookMallBaseUrl();
  const [projects, setProjects] = useState<CanvasProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!base?.trim()) return;
    setLoading(true);
    try {
      const list = await listMyCanvasProjects(base);
      setProjects(list);
      setProjectId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = projects.find((p) => p.id === projectId);

  return (
    <div className="canvas-page canvas-page-fill py-6 sm:py-8 lg:py-10">
      <header className="mb-8">
        <p className="twenty-eyebrow">canvas-web · story-pro</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="canvas-serif text-3xl text-white">我的项目资产</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--canvas-muted)]">
              统一项目资产库（12 类）：角色、场景、道具、大纲、分镜脚本、音频、分镜图、分镜视频、数字人、风格、提示词、组资产。三版画布共用；平台风格预设请见顶部「风格库」。
            </p>
          </div>
          <Link
            href="/guides/project-assets"
            className="twenty-btn-ghost text-sm"
          >
            使用说明
          </Link>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[var(--canvas-surface)] p-4">
        <Layers className="size-5 shrink-0 text-cyan-300" />
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[11px] text-[var(--canvas-muted)]">选择画布项目</span>
          <select
            className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
            value={projectId}
            disabled={loading || !projects.length}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {!projects.length ? (
              <option value="">暂无项目</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))
            )}
          </select>
        </label>
        {selected ? (
          <Link
            href={`/canvas/${selected.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 px-3 py-2 text-[12px] text-cyan-100 hover:bg-cyan-500/10"
          >
            打开画布
            <ExternalLink className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="rounded-xl border border-cyan-400/15 bg-cyan-950/10 p-5">
        {loading ? (
          <p className="text-sm text-[var(--canvas-muted)]">加载项目列表…</p>
        ) : (
          <UnifiedProjectAssetsView projectId={projectId || null} />
        )}
      </div>
    </div>
  );
}

export function AssetsClient() {
  return <Inner />;
}
