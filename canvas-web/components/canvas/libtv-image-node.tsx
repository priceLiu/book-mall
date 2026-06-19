"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { usePointerImagePasteHost } from "@/lib/canvas/image-upload-handlers";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useNodes } from "@xyflow/react";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_MEDIA_CARD_SHELL_CLASS,
  LIBTV_MEDIA_STAGE_CLASS,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
} from "@/lib/canvas/libtv-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH,
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { CanvasEnginePick } from "@/lib/canvas/types";
import type { Pro2ImageMediaRole } from "@/lib/canvas/story-pro2-workspace-types";
import type { CanvasPortraitNodeFields } from "@/lib/canvas/portrait-node-data";
import { isPortraitNodeActive } from "@/lib/canvas/portrait-node-data";
import { useImportPortraitToLibrary } from "@/lib/canvas/use-import-portrait-to-library";
import { Sbv1PortraitLivenessModal } from "./sbv1/sbv1-portrait-liveness-modal";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { useLibtvMediaNodeAutoFit } from "@/lib/canvas/libtv-media-node-auto-fit";
import { cn } from "@/lib/utils";
import { MediaHoverBox, MediaPreviewLightbox } from "./media-hover-box";
import { LibtvNodeHeaderPreviewButton } from "./libtv-node-header-preview-button";
import { Pro2ImageNodeToolbar } from "./pro2/pro2-image-node-toolbar";
import {
  Pro2MediaNodeEmptyState,
  Pro2MediaNodeErrorState,
} from "./pro2/pro2-media-node-empty";
import { Pro2NodeResizer } from "./pro2/pro2-node-resizer";
import type { Pro2AddMenuSection } from "@/lib/canvas/pro2-add-node-menu";
import { Pro2NodeSidePlus } from "./pro2/pro2-node-side-plus";
import {
  LibtvMediaGeneratingState,
  isLibtvMediaGenerating,
} from "./libtv-media-generating-state";

export type LibtvImageNodeEdition = "pro2" | "sbv1";

export type LibtvImageNodeData = CanvasPortraitNodeFields & {
  label?: string;
  ossUrl?: string;
  blobUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  runtime?: { status?: string; failMessage?: string };
  dockInput?: string;
  engine?: CanvasEnginePick;
  imageMode?: string;
  pro2MediaRole?: Pro2ImageMediaRole | string;
};

export type LibtvImageNodeProps = NodeProps & {
  edition: LibtvImageNodeEdition;
  rfNodeType: "sbv1-image" | "story-pro2-image";
  saveAsAssetKind: "sbv1-image" | "story-pro2-image";
  leftMenuSections: Pro2AddMenuSection[];
  rightMenuSections: Pro2AddMenuSection[];
  onSidePickLeft: (itemId: string, nodeType?: string) => void;
  onSidePickRight: (itemId: string, nodeType?: string) => void;
  onSelectAfterDuplicate: (newId: string) => void;
};

const EDITION_CHROME: Record<
  LibtvImageNodeEdition,
  { ring: string; icon: string; spinner: string; generating: "violet" | "cyan" }
> = {
  pro2: {
    ring: "ring-1 ring-violet-400/45",
    icon: "text-violet-300",
    spinner: "text-violet-300",
    generating: "violet",
  },
  sbv1: {
    ring: "ring-1 ring-cyan-400/50",
    icon: "text-cyan-300",
    spinner: "text-cyan-300",
    generating: "cyan",
  },
};

function generatingLabelFor(
  edition: LibtvImageNodeEdition,
  d: LibtvImageNodeData,
): string {
  if (d.uploading && !d.runtime?.status) return "上传中…";
  const role = d.pro2MediaRole;
  if (role === "character-three-view") return "生成三视图中…";
  if (role === "scene") return "生成场景图中…";
  if (role === "frame") return "分镜图生成中…";
  return "图片生成中…";
}

/** LibTV 统一图片节点（分镜 1.0 · 影视专业 2.0） */
export function LibtvImageNode({
  id,
  data,
  selected,
  edition,
  rfNodeType,
  saveAsAssetKind,
  leftMenuSections,
  rightMenuSections,
  onSidePickLeft,
  onSidePickRight,
  onSelectAfterDuplicate,
}: LibtvImageNodeProps) {
  const chrome = EDITION_CHROME[edition];
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);
  const inputRef = useRef<HTMLInputElement>(null);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [livenessOpen, setLivenessOpen] = useState(false);
  const projectId = useCanvasStore((s) => s.projectId) ?? undefined;

  const d = data as unknown as LibtvImageNodeData;
  const saveAsAsset = useSaveNodeAsAsset();
  const self = nodes.find((n) => n.id === id);
  const insideGroup = Boolean(self?.parentId);
  const mediaRole = d.pro2MediaRole ?? "generic";
  const isCharacterThreeView = mediaRole === "character-three-view";
  const previewUrl = d.ossUrl ?? d.blobUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const portraitActive = isPortraitNodeActive(
    (self?.data ?? d) as CanvasPortraitNodeFields,
  );
  const { importPortrait, importing: portraitImporting } =
    useImportPortraitToLibrary({
      nodeId: id,
      edition,
      projectId,
      imageUrl: d.ossUrl,
      onNeedLiveness: () => setLivenessOpen(true),
    });
  const isGenerating = isLibtvMediaGenerating(d);
  const hasRuntimeError = d.runtime?.status === "error";
  const hasUploadError = Boolean(d.uploadError?.trim()) && !isGenerating;
  const hasError = hasRuntimeError || hasUploadError;
  const errorMessage = hasRuntimeError
    ? d.runtime?.failMessage?.trim() || "生成失败"
    : d.uploadError?.trim() || "生成失败";
  const generatingLabel = generatingLabelFor(edition, d);
  const showSidePlus = Boolean(
    (hovered || selected || connectingFromNodeId) && !isGenerating,
  );
  const soleSelected = useMemo(
    () => selected && rfNodes.filter((n) => n.selected).length === 1,
    [selected, rfNodes],
  );
  const showTryMenu =
    !isCharacterThreeView && !hasImage && !isGenerating && !hasError;
  const showImageTools = Boolean(
    soleSelected &&
      !isGenerating &&
      !isCharacterThreeView &&
      (hasImage ||
        Boolean(d.dockInput?.trim()) ||
        Boolean(d.engine?.modelKey?.trim())),
  );

  useLibtvMediaNodeAutoFit({
    nodeId: id,
    mediaUrl: previewUrl,
    kind: "image",
    profile: "square-image",
    disabled: !hasImage || isGenerating || isCharacterThreeView,
  });

  const nodeLabel = useMemo(() => {
    if (isCharacterThreeView) return d.label?.trim() || "角色";
    if (d.label?.trim()) return d.label.trim();
    const imgs = nodes.filter((n) => n.type === rfNodeType);
    const idx = imgs.findIndex((n) => n.id === id);
    return `图片 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [nodes, id, d.label, isCharacterThreeView, rfNodeType]);

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
        ...(edition === "sbv1" ? { imageMode: "upload" as const } : {}),
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
    [id, base, updateNodeData, alert, edition],
  );

  const pasteHostActive = hovered || Boolean(selected && showTryMenu);
  usePointerImagePasteHost(pasteHostActive, id, (file) => void onFile(file));

  const onDuplicateNode = useCallback(() => {
    const newId = duplicateNode(id, { preserveContent: true });
    if (newId) onSelectAfterDuplicate(newId);
  }, [duplicateNode, id, onSelectAfterDuplicate]);

  const renderStage = () => {
    if (isCharacterThreeView) {
      if (isGenerating) {
        return (
          <LibtvMediaGeneratingState
            label={generatingLabel}
            variant={chrome.generating}
          />
        );
      }
      if (hasImage) {
        return (
          <MediaHoverBox
            src={previewUrl}
            variant="generated"
            alt={nodeLabel}
            fit="contain"
            hidePreviewOverlay
            className="absolute inset-0"
          />
        );
      }
      if (hasError) {
        return (
          <Pro2MediaNodeErrorState
            icon={AlertTriangle}
            title="生成失败"
            message={errorMessage}
          />
        );
      }
      return (
        <Pro2MediaNodeEmptyState
          icon={ImageIcon}
          label="等待生成三视图"
          passNodeDrag
        />
      );
    }

    if (isGenerating) {
      return (
        <LibtvMediaGeneratingState label={generatingLabel} variant={chrome.generating}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 size-full object-contain opacity-40"
              draggable={false}
            />
          ) : null}
        </LibtvMediaGeneratingState>
      );
    }
    if (hasImage) {
      return (
        <MediaHoverBox
          src={previewUrl}
          variant="generated"
          alt={nodeLabel}
          fit="contain"
          hidePreviewOverlay
          className="absolute inset-0"
        />
      );
    }
    if (hasError) {
      return (
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
            title={hasUploadError && !hasRuntimeError ? "上传失败" : "生成失败"}
            message={errorMessage}
          />
        </div>
      );
    }
    if (showTryMenu) {
      return (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-3 py-4"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (selected && !isGenerating) onPick();
          }}
        >
          <Pro2MediaNodeEmptyState
            icon={ImageIcon}
            label="添加或生成图片"
            className="min-h-0 pb-0"
            passNodeDrag
          />
          {!selected ? (
            <p className="mt-3 text-[10px] text-white/35">选中节点以编辑提示词</p>
          ) : (
            <p className="mt-3 text-[10px] text-white/35">
              双击图标上传，或在下方 Dock 输入提示词
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Pro2NodeResizer
        isVisible={Boolean(selected && !insideGroup)}
        minWidth={
          isCharacterThreeView
            ? PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH
            : PRO2_IMAGE_NODE_MIN_WIDTH
        }
        minHeight={
          isCharacterThreeView
            ? PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT
            : PRO2_IMAGE_NODE_MIN_HEIGHT
        }
      />
      <div
        className={cn(LIBTV_NODE_OUTER_CLASS, "image-paste-host")}
        data-image-paste-host={id}
        data-pro2-dock-anchor={id}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {!isCharacterThreeView ? (
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
                  : "pointer-events-none opacity-0",
            )}
            title="上游参考图"
          />
        ) : null}
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
          title="连线到下游"
        />

        {showSidePlus ? (
          <>
            <Pro2NodeSidePlus
              side="left"
              handleId="plus_left"
              visible
              className="z-[60] -left-5"
              sections={leftMenuSections}
              onPick={onSidePickLeft}
            />
            <Pro2NodeSidePlus
              side="right"
              handleId="image"
              visible
              className="z-[60] -right-5"
              sections={rightMenuSections}
              onPick={onSidePickRight}
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
              saveAsAsset(id, saveAsAssetKind, d as unknown as Record<string, unknown>)
            }
            onImportPortrait={
              d.ossUrl ? () => void importPortrait() : undefined
            }
            portraitImporting={portraitImporting}
            portraitActive={portraitActive}
            onDuplicateNode={onDuplicateNode}
          />
        ) : null}

        <div
          className={cn(
            LIBTV_MEDIA_CARD_SHELL_CLASS,
            LIBTV_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
            selected && chrome.ring,
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "nodrag flex items-center gap-2 rounded-md transition",
                  !hasImage &&
                    !isGenerating &&
                    !isCharacterThreeView &&
                    "cursor-pointer hover:bg-white/[0.06]",
                )}
                title={
                  !hasImage && !isGenerating && !isCharacterThreeView
                    ? "双击上传图片"
                    : undefined
                }
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!hasImage && !isGenerating && !isCharacterThreeView) {
                    onPick();
                  }
                }}
              >
                <ImageIcon className={cn("size-3.5", chrome.icon)} />
                <p className="text-xs font-medium text-white">{nodeLabel}</p>
              </button>
            </div>
            {isGenerating ? (
              <Loader2 className={cn("size-3.5 animate-spin", chrome.spinner)} />
            ) : (
              <LibtvNodeHeaderPreviewButton
                visible={hasImage}
                onClick={() => setPreviewOpen(true)}
              />
            )}
          </div>

          <div className={LIBTV_MEDIA_STAGE_CLASS}>{renderStage()}</div>
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
          alt={nodeLabel}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      <Sbv1PortraitLivenessModal
        open={livenessOpen}
        onClose={() => setLivenessOpen(false)}
        onSuccess={() => setLivenessOpen(false)}
      />
    </>
  );
}
