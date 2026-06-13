"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { usePointerImagePasteHost } from "@/lib/canvas/image-upload-handlers";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_RIGHT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  handleSbv1ImageSideAddNodePick,
  spawnSbv1NeighborFromNode,
} from "@/lib/canvas/sbv1-spawn-nodes";
import {
  SBV1_CARD_DRAG_CLASS,
  SBV1_CARD_SHELL_CLASS,
  SBV1_NODE_HANDLE_CLASS,
  SBV1_NODE_OUTER_CLASS,
} from "@/lib/canvas/sbv1-node-chrome";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import {
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
} from "@/lib/canvas/story-pro2-node-chrome";
import { cn } from "@/lib/utils";
import { MediaHoverBox } from "../media-hover-box";
import { Pro2ImageNodeToolbar } from "../pro2/pro2-image-node-toolbar";
import {
  Pro2MediaNodeEmptyState,
  Pro2MediaNodeErrorState,
} from "../pro2/pro2-media-node-empty";
import { Pro2NodeResizer } from "../pro2/pro2-node-resizer";
import { Pro2NodeSidePlus } from "../pro2/pro2-node-side-plus";
import {
  Sbv1ImageNodeEmbeddedDock,
  sbv1ImageNodeUsesEmbeddedDock,
} from "./sbv1-image-node-embedded-dock";

export function Sbv1ImageNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const d = data as unknown as Sbv1ImageNodeData;
  const self = nodes.find((n) => n.id === id);
  const insideGroup = Boolean(self?.parentId);
  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isGenerating = Boolean(d.uploading);
  const hasError = Boolean(d.uploadError?.trim());
  const showSidePlus = Boolean(selected && !isGenerating);
  const soleSelected = useMemo(
    () => selected && nodes.filter((n) => n.selected).length === 1,
    [selected, nodes],
  );
  const showTryMenu = !hasImage && !isGenerating && !hasError;
  const showEmbeddedDock = sbv1ImageNodeUsesEmbeddedDock(d, {
    selected: Boolean(selected),
    soleSelected,
  });
  const showImageTools = Boolean(soleSelected && hasImage && !isGenerating);

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

  const pasteHostActive =
    hovered || Boolean(selected && (showEmbeddedDock || showTryMenu));
  usePointerImagePasteHost(pasteHostActive, id, (file) => void onFile(file));

  const spawnStore = useMemo(
    () => ({ nodes, edges, addNode, addNodeInGroup, setNodes, setEdges }),
    [nodes, edges, addNode, addNodeInGroup, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handleSbv1ImageSideAddNodePick(
        itemId,
        nodeType,
        side,
        alert,
        () => {
          spawnSbv1NeighborFromNode(id, side, "sbv1-image", spawnStore);
        },
        () => {
          if (side === "right") {
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
        isVisible={Boolean(selected && !insideGroup)}
        minWidth={PRO2_IMAGE_NODE_MIN_WIDTH}
        minHeight={PRO2_IMAGE_NODE_MIN_HEIGHT}
      />
      <div
        className={cn(SBV1_NODE_OUTER_CLASS, "image-paste-host")}
        data-image-paste-host={id}
        data-pro2-dock-anchor={id}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <Handle
          id="in_image"
          type="target"
          position={Position.Left}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : selected
                ? "opacity-100"
                : "pointer-events-none opacity-0",
          )}
          title="上游参考图"
        />
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
          title="连线到下游"
        />

        {showSidePlus ? (
          <>
            <Pro2NodeSidePlus
              side="left"
              handleId="plus_left"
              visible
              className="z-[60] -left-5"
              sections={PRO2_IMAGE_LEFT_ADD_MENU}
              onPick={onSidePick("left")}
            />
            <Pro2NodeSidePlus
              side="right"
              handleId="image"
              visible
              className="z-[60] -right-5"
              sections={PRO2_RIGHT_ADD_MENU}
              onPick={onSidePick("right")}
            />
          </>
        ) : null}

        {showImageTools ? (
          <Pro2ImageNodeToolbar
            passNodeDrag
            className="absolute left-1/2 z-40 -translate-x-1/2"
            style={{ top: -60 }}
            previewUrl={previewUrl}
            onExpandPreview={() => setPreviewOpen(true)}
          />
        ) : null}

        <div
          className={cn(
            SBV1_CARD_SHELL_CLASS,
            SBV1_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
            selected && "ring-1 ring-cyan-400/50",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-3.5 text-cyan-300" />
              <p className="text-xs font-medium text-white">{nodeLabel}</p>
            </div>
            {isGenerating ? (
              <Loader2 className="size-3.5 animate-spin text-cyan-300" />
            ) : null}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black/40">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 px-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt=""
                    className="absolute inset-0 size-full object-contain opacity-40"
                    draggable={false}
                  />
                ) : null}
                <Loader2 className="relative z-[1] size-6 animate-spin text-violet-200/80" />
                <span className="relative z-[1] text-[11px] text-violet-100/70">
                  上传中…
                </span>
              </div>
            ) : hasImage ? (
              <MediaHoverBox
                src={previewUrl}
                variant="generated"
                alt={nodeLabel}
                fit="contain"
                className="absolute inset-0"
              />
            ) : hasError ? (
              <div
                role="button"
                tabIndex={0}
                className="absolute inset-0 flex flex-col"
                onClick={onPick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick();
                  }
                }}
              >
                <Pro2MediaNodeErrorState
                  icon={AlertTriangle}
                  title="上传失败"
                  message={d.uploadError}
                />
              </div>
            ) : showEmbeddedDock ? (
              <Sbv1ImageNodeEmbeddedDock nodeId={id} onUpload={onPick} />
            ) : showTryMenu ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-3 py-4">
                <Pro2MediaNodeEmptyState
                  icon={ImageIcon}
                  label="添加或生成图片"
                  className="min-h-0 pb-0"
                  passNodeDrag
                />
                {!selected ? (
                  <p className="mt-3 text-[10px] text-white/35">
                    选中节点以编辑提示词
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />

      {previewOpen && previewUrl ? (
        <div
          className="nodrag fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setPreviewOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={nodeLabel}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
