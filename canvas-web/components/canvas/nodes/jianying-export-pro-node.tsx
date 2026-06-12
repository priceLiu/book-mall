"use client";

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Download, Film } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingExportNodeData } from "@/lib/canvas/types";
import { collectJianyingFramesFromWorkspace } from "@/lib/canvas/jianying-from-workspace";
import { findStoryProWorkspaceForStarter } from "@/lib/canvas/spawn-story-pro-workspace";
import { resolveStarterForHub } from "@/lib/canvas/story-workspace-resolver";
import { exportJianyingZip } from "@/lib/canvas-api";
import { JianyingMediaRenderActions } from "../jianying-media-render-actions";
import { NodeShell } from "../node-shell";

export function JianyingExportProNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as unknown as JianyingExportNodeData;
  const [loading, setLoading] = useState<"bundle" | "draft" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const starter = d.hubNodeId
    ? resolveStarterForHub(nodes, edges, d.hubNodeId)
    : undefined;
  const stored = (
    starter?.data as { workspaceIds?: import("@/lib/canvas/story-pro-workspace-types").StoryProWorkspaceIds }
  )?.workspaceIds;
  const ws =
    starter && d.hubNodeId
      ? findStoryProWorkspaceForStarter(
          nodes,
          edges,
          starter.id,
          stored,
        )
      : null;

  const workspaceFrames = ws
    ? collectJianyingFramesFromWorkspace(nodes, ws)
    : [];
  const frames = workspaceFrames.map((f) => ({
    ...f,
    dialogue: f.dialogue ?? "",
  }));

  const onExport = async (format: "bundle" | "draft") => {
    if (!base || !projectId || !frames.length) {
      setErr("请先完成专业版视频列各镜视频与配音");
      return;
    }
    setLoading(format);
    setErr(null);
    try {
      await exportJianyingZip(base, projectId, { format, frames });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <NodeShell
      title={d.label ?? "剪映导出 · 专业版"}
      selected={selected}
      minWidth={360}
      minHeight={820}
      jianyingResizer
      bodyNoScroll
      inputs={[
        { id: "in_storyboard", label: "分镜表", kind: "text" },
        { id: "in_video", label: "各镜视频", kind: "image" },
      ]}
      footer={
        <span className="text-[10px] text-[var(--canvas-muted)]">
          Mac：下载 ZIP → 本地导入剪映
        </span>
      }
    >
      <div className="flex flex-col gap-3 p-1">
        <p className="text-[11px] text-white/70">
          已识别 <strong>{frames.length}</strong> 镜；
          含视频 {frames.filter((f) => f.videoUrl).length} · 配音{" "}
          {frames.filter((f) => f.audioUrl).length}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={loading !== null}
            className="nodrag flex items-center justify-center gap-2 rounded-md bg-[var(--canvas-accent)] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            onClick={() => void onExport("bundle")}
          >
            <Download className="size-4" />
            {loading === "bundle" ? "打包中…" : "分包导入 · 分镜包 ZIP（推荐）"}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            className="nodrag flex items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 text-[12px] text-white/90 hover:bg-white/5 disabled:opacity-50"
            onClick={() => void onExport("draft")}
          >
            <Film className="size-4" />
            {loading === "draft" ? "生成中…" : "全包导入 · 剪映草稿 ZIP（Mac）"}
          </button>
        </div>
        <JianyingMediaRenderActions
          nodeId={id}
          base={base}
          projectId={projectId}
          frames={frames}
          persisted={d.mediaRenderResult}
        />
        <p className="text-[10px] leading-relaxed text-[var(--canvas-muted)]">
          草稿包解压至剪映「草稿位置」对应文件夹。剪映 6+ 若无法打开，请用分镜包。
        </p>
        {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
      </div>
    </NodeShell>
  );
}
