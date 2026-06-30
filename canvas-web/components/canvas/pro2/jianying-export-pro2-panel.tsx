"use client";

import { useState } from "react";
import { Download, Film } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingExportNodeData } from "@/lib/canvas/types";
import type { JianyingFrameExport } from "@/lib/canvas/jianying-from-workspace";
import { exportJianyingZip } from "@/lib/canvas-api";
import { JianyingMediaRenderActions } from "../jianying-media-render-actions";

type Props = {
  nodeId: string;
  data: JianyingExportNodeData;
  connectedCount: number;
  renderedCount: number;
  frames: JianyingFrameExport[];
};

export function JianyingExportPro2Panel({
  nodeId,
  data,
  connectedCount,
  renderedCount,
  frames,
}: Props) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const [loading, setLoading] = useState<"bundle" | "draft" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const exportFrames = frames.map((f) => ({
    ...f,
    dialogue: f.dialogue ?? "",
  }));
  const audioCount = exportFrames.filter((f) => f.audioUrl).length;
  const ready = renderedCount > 0;

  const onExport = async (format: "bundle" | "draft") => {
    if (!base || !projectId || !exportFrames.length) {
      setErr("请先接入至少 1 个已生成视频");
      return;
    }
    setLoading(format);
    setErr(null);
    try {
      await exportJianyingZip(base, projectId, { format, frames: exportFrames });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 px-3 pb-3">
      <p className="text-[11px] text-white/75">
        已连接 <strong className="text-white">{connectedCount}</strong>
        {" · "}
        成片 <strong className="text-white">{renderedCount}</strong>
        <span className="text-white/45">
          {" "}
          （已识别 {connectedCount} 镜；含视频 {renderedCount} · 配音 {audioCount}）
        </span>
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={loading !== null || !ready}
          className="nodrag flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#2A2A2A] px-3 py-2.5 text-[12px] font-medium text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => void onExport("bundle")}
        >
          <Download className="size-4 shrink-0" />
          {loading === "bundle" ? "打包中…" : "分包导入 · 分镜包 ZIP（推荐）"}
        </button>
        <button
          type="button"
          disabled={loading !== null || !ready}
          className="nodrag flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] text-white/90 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => void onExport("draft")}
        >
          <Film className="size-4 shrink-0" />
          {loading === "draft" ? "生成中…" : "全包导入 · 剪映草稿 ZIP（Mac）"}
        </button>
      </div>

      <JianyingMediaRenderActions
        nodeId={nodeId}
        base={base}
        projectId={projectId}
        frames={exportFrames}
        persisted={data.mediaRenderResult}
      />

      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
    </div>
  );
}
