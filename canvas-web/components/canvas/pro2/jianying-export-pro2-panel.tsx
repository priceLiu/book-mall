"use client";

import { useState } from "react";
import { Download, Film } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingExportNodeData } from "@/lib/canvas/types";
import type { JianyingFrameExport } from "@/lib/canvas/jianying-from-workspace";
import { exportJianyingZip } from "@/lib/canvas-api";
import {
  PRO2_HINT_LABEL_CLASS,
  PRO2_STAGE_BADGE_CLASS,
} from "@/lib/canvas/story-pro2-node-chrome";
import { JianyingMediaRenderActions } from "../jianying-media-render-actions";

type Props = {
  nodeId: string;
  data: JianyingExportNodeData;
  frames: JianyingFrameExport[];
};

export function JianyingExportPro2Panel({ nodeId, data, frames }: Props) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const [loading, setLoading] = useState<"bundle" | "draft" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const exportFrames = frames.map((f) => ({
    ...f,
    dialogue: f.dialogue ?? "",
  }));
  const videoCount = exportFrames.filter((f) => f.videoUrl).length;
  const audioCount = exportFrames.filter((f) => f.audioUrl).length;
  const ready = videoCount > 0;

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
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/75">
          已识别 <strong className="text-white">{exportFrames.length}</strong> 镜；
          含视频 {videoCount} · 配音 {audioCount}
        </p>
        <span className={PRO2_STAGE_BADGE_CLASS}>
          {data.mediaRenderResult?.downloadUrl
            ? "成片就绪"
            : ready
              ? "就绪"
              : "待接入"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={loading !== null || !ready}
          className="nodrag flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-[12px] font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
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

      <p className={`${PRO2_HINT_LABEL_CLASS} leading-relaxed`}>
        草稿包解压至剪映「草稿位置」对应文件夹。剪映 6+ 若无法打开，请用分镜包。
      </p>
      <p className="text-[10px] text-white/45">
        Mac：下载 ZIP → 本地导入剪映
      </p>
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
    </div>
  );
}
