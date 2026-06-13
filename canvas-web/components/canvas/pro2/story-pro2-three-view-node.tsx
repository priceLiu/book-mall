"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_RIGHT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  spawnPro2ScriptHubFromSource,
} from "@/lib/canvas/pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_CARD_SHELL_CLASS,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryPro2ThreeViewNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { cn } from "@/lib/utils";
import { MediaHoverBox } from "../media-hover-box";
import {
  Pro2MediaNodeEmptyState,
  Pro2MediaNodeErrorState,
} from "./pro2-media-node-empty";
import { Pro2ImageNodeToolbar } from "./pro2-image-node-toolbar";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import {
  Pro2ThreeViewNodeEmbeddedDock,
  pro2ThreeViewNodeUsesEmbeddedDock,
} from "./pro2-three-view-node-embedded-dock";

/** 2.0 角色三视图 · 壳层与图片节点一致（LibTV） */
export function StoryPro2ThreeViewNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const d = data as unknown as StoryPro2ThreeViewNodeData;
  const saveAsAsset = useSaveNodeAsAsset();
  const self = nodes.find((n) => n.id === id);
  const insideGroup = Boolean(self?.parentId);
  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isGenerating = Boolean(d.uploading);
  const hasError = Boolean(d.uploadError?.trim());
  const label = d.label?.trim() || "角色";
  const showSidePlus = Boolean(selected && !isGenerating);
  const soleSelected = useMemo(
    () => selected && nodes.filter((n) => n.selected).length === 1,
    [selected, nodes],
  );
  const showImageTools = Boolean(soleSelected && hasImage && !isGenerating);
  const showEmbeddedDock = pro2ThreeViewNodeUsesEmbeddedDock(d, {
    selected: Boolean(selected),
    soleSelected,
  });

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
      }
    },
    [base, id, updateNodeData],
  );

  const spawnNeighbor = useCallback(
    (side: "left" | "right", nodeType?: string) => {
      if (!nodeType) return;
      const selfNode = nodes.find((n) => n.id === id);
      if (!selfNode) return;
      const gap = 48;
      const w = selfNode.width ?? PRO2_IMAGE_NODE_WIDTH;
      const x =
        side === "left"
          ? selfNode.position.x - w - gap
          : selfNode.position.x + w + gap;
      const y = selfNode.position.y;

      if (nodeType === "story-pro2-starter") {
        const newId = addNode("story-pro2-starter", { x, y }, buildPro2StarterNodeData());
        if (!newId) return;
        const edge =
          side === "left"
            ? {
                id: `e-${newId}-${id}`,
                source: newId,
                target: id,
                sourceHandle: "text",
                targetHandle: "in_image",
              }
            : {
                id: `e-${id}-${newId}`,
                source: id,
                target: newId,
                sourceHandle: "image",
                targetHandle: "in_text",
              };
        setEdges((prev) => [...prev, edge]);
        selectPro2NodeAfterSpawn(setNodes, newId);
        return;
      }

      if (nodeType === "story-pro2-image") {
        const newId = addNode("story-pro2-image", { x, y }, buildPro2ImageNodeData());
        if (!newId) return;
        const edge =
          side === "left"
            ? {
                id: `e-${newId}-${id}`,
                source: newId,
                target: id,
                sourceHandle: "image",
                targetHandle: "in_image",
              }
            : {
                id: `e-${id}-${newId}`,
                source: id,
                target: newId,
                sourceHandle: "image",
                targetHandle: "in_image",
              };
        setEdges((prev) => [...prev, edge]);
        selectPro2NodeAfterSpawn(setNodes, newId);
        return;
      }

      if (nodeType === "story-pro2-script-hub") {
        spawnPro2ScriptHubFromSource({
          sourceId: id,
          sourceHandle: "image",
          position: { x, y },
          addNode: (type, position, nodeData) =>
            addNode(type, position, nodeData),
          setEdges,
          setNodes,
        });
      }
    },
    [nodes, id, addNode, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          if (itemId === "text" || nodeType === "story-pro2-starter") {
            spawnNeighbor(side, "story-pro2-starter");
            return;
          }
          if (itemId === "image" || nodeType === "story-pro2-image") {
            spawnNeighbor(side, "story-pro2-image");
            return;
          }
          if (itemId === "script" || nodeType === "story-pro2-script-hub") {
            spawnNeighbor("right", "story-pro2-script-hub");
          }
        },
      );
    },
    [spawnNeighbor, alert],
  );

  return (
    <>
      <Pro2NodeResizer
        isVisible={Boolean(selected && !insideGroup)}
        minWidth={PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH}
        minHeight={PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT}
      />
      <div
        className={cn(LIBTV_NODE_OUTER_CLASS, "image-paste-host")}
        data-pro2-dock-anchor={id}
      >
        <Handle
          id="in_image"
          type="target"
          position={Position.Left}
          className={cn(
            LIBTV_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : selected
                ? "opacity-100"
                : "opacity-0 pointer-events-none",
          )}
        />
        <Handle
          id="image"
          type="source"
          position={Position.Right}
          className={cn(
            LIBTV_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : selected
                ? "opacity-100"
                : "pointer-events-none opacity-0",
          )}
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
            onSaveAsAsset={() =>
              saveAsAsset(
                id,
                "story-pro2-three-view",
                d as unknown as Record<string, unknown>,
                "CHARACTER",
              )
            }
          />
        ) : null}

        <div
          className={cn(
            LIBTV_CARD_SHELL_CLASS,
            LIBTV_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
            selected && "ring-1 ring-violet-400/45",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-3.5 text-violet-300" />
              <p className="text-xs font-medium text-white">{label}</p>
            </div>
            {isGenerating ? (
              <Loader2 className="size-3.5 animate-spin text-violet-300" />
            ) : null}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black/40">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px] text-violet-200/70">
                <Loader2 className="size-6 animate-spin" />
                <span>生成三视图中…</span>
              </div>
            ) : hasImage ? (
              <MediaHoverBox
                src={previewUrl}
                variant="generated"
                alt={label}
                fit="contain"
                className="absolute inset-0"
              />
            ) : hasError ? (
              <Pro2MediaNodeErrorState
                icon={AlertTriangle}
                title="生成失败"
                message={d.uploadError}
              />
            ) : showEmbeddedDock ? (
              <Pro2ThreeViewNodeEmbeddedDock nodeId={id} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-3 py-4">
                <Pro2MediaNodeEmptyState
                  icon={ImageIcon}
                  label="等待生成三视图"
                  className="min-h-0 pb-0"
                  passNodeDrag
                />
                <p className="mt-3 text-[10px] text-white/35">
                  选中节点以编辑提示词
                </p>
              </div>
            )}
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
            alt={label}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
