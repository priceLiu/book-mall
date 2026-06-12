"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { usePointerImagePasteHost } from "@/lib/canvas/image-upload-handlers";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  SBV1_IMAGE_LEFT_ADD_MENU,
  SBV1_IMAGE_RIGHT_ADD_MENU,
} from "@/lib/canvas/sbv1-add-node-menu";
import {
  handleSbv1SideAddNodePick,
  spawnSbv1NeighborFromNode,
} from "@/lib/canvas/sbv1-spawn-nodes";
import {
  SBV1_CARD_SHELL_CLASS,
  SBV1_IMAGE_NODE_MIN_HEIGHT,
  SBV1_IMAGE_NODE_MIN_WIDTH,
  SBV1_NODE_HANDLE_CLASS,
  SBV1_NODE_OUTER_CLASS,
} from "@/lib/canvas/sbv1-node-chrome";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { MediaHoverBox } from "../media-hover-box";
import { Pro2NodeResizer } from "../pro2/pro2-node-resizer";
import { Pro2NodeSidePlus } from "../pro2/pro2-node-side-plus";

export function Sbv1ImageNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);

  const d = data as unknown as Sbv1ImageNodeData;
  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isGenerating = Boolean(d.uploading);
  const hasError = Boolean(d.uploadError?.trim());
  const showSidePlus = Boolean(selected && !isGenerating);
  const [hovered, setHovered] = useState(false);

  const nodeLabel = useMemo(() => {
    if (d.label?.trim()) return d.label.trim();
    const imgs = nodes.filter((n) => n.type === "sbv1-image");
    const idx = imgs.findIndex((n) => n.id === id);
    return `图片 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id, d.label]);

  const onPick = useCallback(() => inputRef.current?.click(), []);

  const onFile = useCallback(
    async (file: File) => {
      if (
        !file ||
        (!file.type.startsWith("image/") &&
          !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name))
      ) {
        return;
      }
      const blobUrl = URL.createObjectURL(file);
      updateNodeData(id, {
        blobUrl,
        ossUrl: undefined,
        uploading: true,
        uploadError: undefined,
        label: file.name.replace(/\.[^.]+$/, "") || "图片",
        imageMode: "upload",
      });
      if (!base) {
        updateNodeData(id, { uploading: false, uploadError: "画布未就绪" });
        return;
      }
      try {
        const ossUrl = await uploadCanvasImage(base, file);
        updateNodeData(id, { ossUrl, uploading: false });
      } catch (e) {
        updateNodeData(id, {
          uploading: false,
          uploadError: e instanceof Error ? e.message : String(e),
        });
        await alert({
          title: "上传失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      }
    },
    [id, base, updateNodeData, alert],
  );

  usePointerImagePasteHost(
    hovered || Boolean(selected),
    id,
    (file) => void onFile(file),
  );

  const spawnStore = useMemo(
    () => ({ nodes, addNode, setNodes, setEdges }),
    [nodes, addNode, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handleSbv1SideAddNodePick(
        itemId,
        nodeType,
        alert,
        () => {
          if (side === "left") {
            spawnSbv1NeighborFromNode(
              id,
              "left",
              "sbv1-image",
              spawnStore,
              {
                spawnMode:
                  itemId === "txt2img"
                    ? "txt2img"
                    : itemId === "img2img"
                      ? "img2img"
                      : undefined,
              },
            );
            return;
          }
          if (itemId === "video-engine" || nodeType === "sbv1-video-engine") {
            spawnSbv1NeighborFromNode(
              id,
              "right",
              "sbv1-video-engine",
              spawnStore,
            );
          }
        },
      );
    },
    [id, spawnStore, alert],
  );

  return (
    <>
      <Pro2NodeResizer
        isVisible={Boolean(selected)}
        minWidth={SBV1_IMAGE_NODE_MIN_WIDTH}
        minHeight={SBV1_IMAGE_NODE_MIN_HEIGHT}
      />
      <div
        className={SBV1_NODE_OUTER_CLASS}
        data-image-paste-host={id}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <Handle
          id="image"
          type="source"
          position={Position.Right}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : selected
                ? "opacity-100"
                : "pointer-events-none opacity-0",
          )}
          title="连线到视频引擎"
        />

        {showSidePlus ? (
          <>
            <Pro2NodeSidePlus
              side="left"
              handleId="plus_left"
              visible
              className="z-[60] -left-5"
              sections={SBV1_IMAGE_LEFT_ADD_MENU}
              onPick={onSidePick("left")}
            />
            <Pro2NodeSidePlus
              side="right"
              handleId="image"
              visible
              className="z-[60] -right-5"
              sections={SBV1_IMAGE_RIGHT_ADD_MENU}
              onPick={onSidePick("right")}
            />
          </>
        ) : null}

        <div
          className={cn(
            SBV1_CARD_SHELL_CLASS,
            selected && "ring-1 ring-cyan-400/50",
          )}
        >
          <div
            className={cn(
              RF_NODE_DRAG_HANDLE,
              "flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-white/10 px-3 py-2 active:cursor-grabbing",
            )}
          >
            <p className="truncate text-xs font-medium text-white">{nodeLabel}</p>
            {isGenerating ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-cyan-300" />
            ) : null}
          </div>

          <div className="relative min-h-0 flex-1">
            {hasImage ? (
              <div className="nodrag group/image relative h-full min-h-[120px]">
                <MediaHoverBox
                  src={previewUrl}
                  variant="generated"
                  alt={nodeLabel}
                  fit="contain"
                  className="h-full rounded-none"
                />
                <button
                  type="button"
                  className="nodrag absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white/90 opacity-0 transition hover:bg-black/80 group-hover/image:opacity-100"
                  onClick={onPick}
                >
                  替换
                </button>
              </div>
            ) : hasError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-red-300">
                <AlertTriangle className="size-5" />
                <span>{d.uploadError}</span>
                <button
                  type="button"
                  className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
                  onClick={onPick}
                >
                  重试
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/45 hover:bg-white/[0.03] hover:text-white/70"
                onClick={onPick}
              >
                <ImageIcon className="size-8" />
                <span className="text-xs">点击或粘贴图片</span>
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </>
  );
}
