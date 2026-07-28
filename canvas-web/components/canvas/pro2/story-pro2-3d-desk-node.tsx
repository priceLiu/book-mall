"use client";

import { useCallback } from "react";
import type { NodeProps } from "@xyflow/react";
import { Box, Maximize2 } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryPro23dDeskNodeData } from "@/lib/canvas/types";
import { MediaHoverBox } from "../media-hover-box";
import { NodeShell } from "../node-shell";
import { NodeMediaStage } from "../node-ui";

export function StoryPro23dDeskNode({ id, data, selected }: NodeProps) {
  const openEditor = useCanvasStore((s) => s.openDirector3dDeskEditor);
  const d = data as unknown as StoryPro23dDeskNodeData;

  const open = useCallback(() => openEditor(id), [openEditor, id]);

  const previewUrl = d.runtime?.ossUrl ?? d.ossUrl ?? d.thumbUrl ?? d.blobUrl ?? "";

  return (
    <div className="h-full w-full" onDoubleClick={open}>
      <NodeShell
        title="3D导演台"
        subtitle={d.label ?? "机位规划 · 场景摆位 · 截图"}
        selected={selected}
        runtime={d.runtime}
        minWidth={280}
        minHeight={260}
        inputs={[{ id: "panorama", label: "全景背景", kind: "image" }]}
        outputs={[{ id: "image", label: "截图", kind: "image" }]}
      >
        <div className="flex h-full flex-col gap-2">
          <NodeMediaStage>
            <MediaHoverBox
              src={previewUrl || undefined}
              variant="generated"
              clickToPreview={Boolean(previewUrl)}
              alt="3D导演台截图"
              fit="contain"
              placeholder={
                <button
                  type="button"
                  onClick={open}
                  className="nodrag flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--canvas-muted)] transition-colors hover:text-white"
                >
                  <Box className="size-8 opacity-60" />
                  <span className="text-[11px]">尚无截图 · 点击打开导演台</span>
                </button>
              }
            />
          </NodeMediaStage>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-white/50">
              {previewUrl ? "已导出截图（可连线作参考图）" : "在导演台内截图并回传"}
            </span>
            <button
              type="button"
              onClick={open}
              className="nodrag inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/15 px-2 py-1 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-500/25"
            >
              <Maximize2 className="size-3" />
              打开3D导演台
            </button>
          </div>
        </div>
      </NodeShell>
    </div>
  );
}
