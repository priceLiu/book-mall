"use client";

import { useCallback, useRef, useState } from "react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, GripVertical, ImageIcon } from "lucide-react";

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
import { PRO2_TEXT_NODE_TITLE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryPro2ThreeViewNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { openPro2StyleLibraryForMediaNode } from "@/lib/canvas/pro2-open-style-library";
import { cn } from "@/lib/utils";
import { MediaHoverBox, MediaPreviewLightbox } from "../media-hover-box";
import { LibtvEditableNodeTitle } from "../libtv-editable-node-title";
import { useLibtvNodeDuplicate } from "../libtv-node-header-bar";
import {
  Pro2MediaNodeEmptyState,
  Pro2MediaNodeErrorState,
} from "./pro2-media-node-empty";
import { Pro2ImageNodeToolbar } from "./pro2-image-node-toolbar";
import { LibtvNodeToolbarPortal } from "../libtv-node-toolbar-portal";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { useLibtvMediaNodeAutoFit } from "@/lib/canvas/libtv-media-node-auto-fit";
import { useLibtvMediaAspectPresetSync } from "@/lib/canvas/libtv-media-aspect-preset-apply";
import { LibtvMediaGeneratingState, isLibtvMediaGenerating } from "../libtv-media-generating-state";
import { isMislabeledVendorSuccessError } from "@/lib/canvas/friendly-task-error";
import {
  libtvRuntimeErrorAlertTitle,
  useLibtvRuntimeErrorAlert,
} from "@/lib/canvas/libtv-runtime-error-alert";
import { Pro2CrewTaskStatusBadge } from "./pro2-crew-task-status-badge";
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
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const d = data as unknown as StoryPro2ThreeViewNodeData;
  const saveAsAsset = useSaveNodeAsAsset();
  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const isGenerating = isLibtvMediaGenerating(d);
  const hasRuntimeError = d.runtime?.status === "error";
  const hasUploadError = Boolean(d.uploadError?.trim()) && !isGenerating;
  const hasError = hasRuntimeError || hasUploadError;
  const errorMessage = hasRuntimeError
    ? d.runtime?.failMessage?.trim() || "生成失败"
    : d.uploadError?.trim() || "生成失败";
  useLibtvRuntimeErrorAlert({
    nodeId: id,
    status: d.runtime?.status,
    taskId: d.runtime?.taskId,
    failCode: d.runtime?.failCode,
    failMessage: d.runtime?.failMessage,
    dismissedFailTaskId: d.runtime?.dismissedFailTaskId,
    enabled: !isMislabeledVendorSuccessError(
      d.runtime?.failCode,
      d.runtime?.failMessage,
    ),
    onAlert: ({ message, failCode }) => {
      void alert({
        title: libtvRuntimeErrorAlertTitle(failCode, message, "image"),
        message,
        variant: "error",
        dismissOnly: true,
      });
    },
  });
  const label = d.label?.trim() || "角色";
  const showSidePlus = Boolean((hovered || selected || connectingFromNodeId) && !isGenerating);
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const showFloatingToolbar = Boolean(soleSelected && !isGenerating);
  const showImageTools = Boolean(showFloatingToolbar && hasImage);
  const showEmbeddedDock = pro2ThreeViewNodeUsesEmbeddedDock(d, {
    selected: Boolean(selected),
    soleSelected,
  });

  useLibtvMediaAspectPresetSync(id, d.aspectRatio);

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
            edges,
            addNode,
            addNodeInGroup,
            setNodes,
            setEdges,
          });
        },
      );
    },
    [id, nodes, edges, addNode, addNodeInGroup, setNodes, setEdges, alert],
  );

  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-three-view");

  return (
    <>
      <div
        className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS, "image-paste-host flex flex-col")}
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
            "libtv-node-inbound-handle",
            "pointer-events-none !opacity-0 !border-transparent !bg-transparent",
          )}
        />
        {/* plus_left / image 出边由 Pro2NodeSidePlus 提供 */}
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

        {showImageTools ? (
          <LibtvNodeToolbarPortal nodeId={id} visible={showImageTools}>
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
          </LibtvNodeToolbarPortal>
        ) : null}

        <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
          <GripVertical className="size-3.5 shrink-0 text-white/30" />
          <ImageIcon className="size-3.5 shrink-0 text-violet-300" />
          <LibtvEditableNodeTitle
            nodeId={id}
            defaultLabel="角色"
            textClassName="text-[11px] text-white"
          />
          <Pro2CrewTaskStatusBadge nodeId={id} />
        </div>

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
          <div className={cn(LIBTV_MEDIA_STAGE_CLASS, "relative")}>
            {isGenerating ? (
              <LibtvMediaGeneratingState variant="violet" cancelNodeId={id} />
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
                message={errorMessage}
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
