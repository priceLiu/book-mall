"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useNodes } from "@xyflow/react";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  resolveLibtvSideSpawnNodeType,
  spawnLibtvNeighborFromAnchor,
} from "@/lib/canvas/libtv-side-spawn";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_RIGHT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_MEDIA_CARD_SHELL_CLASS,
  LIBTV_MEDIA_STAGE_CLASS,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryPro2ThreeViewNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { openPro2StyleLibraryForMediaNode } from "@/lib/canvas/pro2-open-style-library";
import { cn } from "@/lib/utils";
import { MediaHoverBox, MediaPreviewLightbox } from "../media-hover-box";
import { LibtvNodeHeaderPreviewButton } from "../libtv-node-header-preview-button";
import { useLibtvNodeDuplicate } from "../libtv-node-header-bar";
import {
  Pro2MediaNodeEmptyState,
  Pro2MediaNodeErrorState,
} from "./pro2-media-node-empty";
import { Pro2ImageNodeToolbar } from "./pro2-image-node-toolbar";
import { LibtvNodeToolbarPortal } from "../libtv-node-toolbar-portal";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { useLibtvMediaNodeAutoFit } from "@/lib/canvas/libtv-media-node-auto-fit";
import { LibtvMediaGeneratingState, isLibtvMediaGenerating } from "../libtv-media-generating-state";
import { Pro2CrewTaskStatusBadge } from "./pro2-crew-task-status-badge";
import {
  Pro2ThreeViewNodeEmbeddedDock,
  pro2ThreeViewNodeUsesEmbeddedDock,
} from "./pro2-three-view-node-embedded-dock";

/** 2.0 角色三视图 · 壳层与图片节点一致（LibTV） */
export function StoryPro2ThreeViewNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const d = data as unknown as StoryPro2ThreeViewNodeData;
  const saveAsAsset = useSaveNodeAsAsset();
  const self = nodes.find((n) => n.id === id);
  const insideGroup = Boolean(self?.parentId);
  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isGenerating = isLibtvMediaGenerating(d);
  const hasError = Boolean(d.uploadError?.trim());
  const label = d.label?.trim() || "角色";
  const showSidePlus = Boolean((hovered || selected || connectingFromNodeId) && !isGenerating);
  const soleSelected = useMemo(
    () => selected && rfNodes.filter((n) => n.selected).length === 1,
    [selected, rfNodes],
  );
  const showFloatingToolbar = Boolean(soleSelected && !isGenerating);
  const showImageTools = Boolean(showFloatingToolbar && hasImage);
  const showEmbeddedDock = pro2ThreeViewNodeUsesEmbeddedDock(d, {
    selected: Boolean(selected),
    soleSelected,
  });

  useLibtvMediaNodeAutoFit({
    nodeId: id,
    mediaUrl: previewUrl,
    kind: "image",
    profile: "square-image",
    disabled: !hasImage || (isGenerating && !d.uploading),
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

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          if (itemId === "style-asset") {
            openPro2StyleLibraryForMediaNode(id);
            return;
          }
          const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
          if (!spawnType) return;
          spawnLibtvNeighborFromAnchor(id, side, spawnType, {
            nodes,
            addNode,
            setNodes,
            setEdges,
          });
        },
      );
    },
    [id, nodes, addNode, setNodes, setEdges, alert],
  );

  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-three-view");

  return (
    <>
      <div
        className={cn(LIBTV_NODE_OUTER_CLASS, "image-paste-host")}
        data-pro2-dock-anchor={id}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
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
          id="plus_left"
          type="source"
          position={Position.Left}
          className={cn(LIBTV_NODE_HANDLE_CLASS, "pointer-events-none opacity-0")}
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

        <Pro2NodeSidePlus
          side="left"
          handleId="plus_left"
          visible={showSidePlus}
          size={LIBTV_NODE_SIDE_PLUS_SIZE}
          className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
          sections={PRO2_IMAGE_LEFT_ADD_MENU}
          onPick={onSidePick("left")}
        />
        <Pro2NodeSidePlus
          side="right"
          handleId="image"
          visible={showSidePlus}
          size={LIBTV_NODE_SIDE_PLUS_SIZE}
          className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
          sections={PRO2_RIGHT_ADD_MENU}
          onPick={onSidePick("right")}
        />

        {showFloatingToolbar ? (
          <LibtvNodeToolbarPortal nodeId={id} visible={showFloatingToolbar}>
            {showImageTools ? (
              <Pro2ImageNodeToolbar
                passNodeDrag
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
                onDuplicateNode={onDuplicateNode}
              />
            ) : (
              <Pro2ImageNodeToolbar
                passNodeDrag
                minimal
                onDuplicateNode={onDuplicateNode}
              />
            )}
          </LibtvNodeToolbarPortal>
        ) : null}

        <div
          className={cn(
            LIBTV_MEDIA_CARD_SHELL_CLASS,
            LIBTV_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
          )}
          style={libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "pro2",
          })}
        >
          <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ImageIcon className="size-3.5 shrink-0 text-violet-300" />
              <p className="truncate text-xs font-medium text-white">{label}</p>
            </div>
            <Pro2CrewTaskStatusBadge nodeId={id} />
            <div className="relative z-[1] flex shrink-0 items-center gap-2">
              {!isGenerating ? (
                <LibtvNodeHeaderPreviewButton
                  visible={hasImage}
                  onClick={() => setPreviewOpen(true)}
                />
              ) : (
                <Loader2 className="size-3.5 animate-spin text-violet-300" />
              )}
            </div>
          </div>

          <div className={cn(LIBTV_MEDIA_STAGE_CLASS, "relative")}>
            {isGenerating ? (
              <LibtvMediaGeneratingState variant="violet" />
            ) : hasImage ? (
              <MediaHoverBox
                src={previewUrl}
                variant="generated"
                alt={label}
                fit="cover"
                hidePreviewOverlay
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
        <MediaPreviewLightbox
          src={previewUrl}
          kind="image"
          alt={label}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
