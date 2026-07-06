"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { DockRefCornerBadge } from "@/components/canvas/pro2/dock-ref-corner-badge";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { MentionHoverPreviewPortal } from "@/components/canvas/mentions/mention-hover-preview";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { uploadCanvasImage } from "@/lib/canvas-api";
import { useImagePasteWhenActive } from "@/lib/canvas/image-upload-handlers";
import { spawnPro2DockPastedImages } from "@/lib/canvas/spawn-pro2-dock-paste-images";
import { spawnSbv1ImageDockPastedImages } from "@/lib/canvas/spawn-sbv1-paste-images";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { removeDockRefFromState } from "@/lib/canvas/strip-dock-mentions";
import { setMentionDragData } from "@/lib/canvas/mention-drag";
import {
  PRO2_DOCK_ACTIVE_REF_BORDER_CLASS,
  PRO2_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { useLibtvDockRefThumbMetrics } from "@/lib/canvas/use-libtv-dock-ref-thumb-metrics";
import { cn } from "@/lib/utils";

export type Pro2DockRefImagesProps = {
  refs: StoryRefImage[];
  onChange: (next: StoryRefImage[]) => void;
  disabled?: boolean;
  pasteActive?: boolean;
  maxCount?: number;
  activeIds?: string[];
  /** 删除 chip 时同步从 prompt 移除 @<refId> */
  promptValue?: string;
  onPromptChange?: (next: string) => void;
  /** 设置后：上传/粘贴会在锚点左侧生成图片节点并连线（多图） */
  spawnAnchor?: { nodeId: string; nodeType: string };
};

function DockRefImageChip({
  refItem,
  index,
  active,
  disabled,
  onRemove,
  thumbStyle,
  badgeFontPx,
  badgeMinPx,
}: {
  refItem: StoryRefImage;
  index: number;
  active: boolean;
  disabled?: boolean;
  onRemove: () => void;
  thumbStyle: React.CSSProperties;
  badgeFontPx: number;
  badgeMinPx: number;
}) {
  const [hover, setHover] = useState<{
    rect: DOMRect;
    clientX: number;
    clientY: number;
  } | null>(null);

  const mentionItem: MentionableItem = {
    id: refItem.id,
    label: refItem.label,
    kind: "image",
    previewUrl: refItem.url,
  };

  return (
    <>
      <div
        className={cn(
          "group relative shrink-0 cursor-grab overflow-hidden rounded-lg border bg-white/[0.04] transition-shadow active:cursor-grabbing",
          active
            ? PRO2_DOCK_ACTIVE_REF_BORDER_CLASS
            : PRO2_DOCK_REF_IDLE_BORDER_CLASS,
        )}
        style={thumbStyle}
        title={`${refItem.label} · 可拖入正文 @ 引用`}
        draggable={!disabled}
        onDragStart={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          setMentionDragData(e.dataTransfer, refItem.id);
          setHover(null);
        }}
        onMouseEnter={(e) => {
          if (!refItem.url) return;
          setHover({
            rect: e.currentTarget.getBoundingClientRect(),
            clientX: e.clientX,
            clientY: e.clientY,
          });
        }}
        onMouseMove={(e) => {
          if (!refItem.url) return;
          setHover({
            rect: e.currentTarget.getBoundingClientRect(),
            clientX: e.clientX,
            clientY: e.clientY,
          });
        }}
        onMouseLeave={() => setHover(null)}
      >
        {refItem.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={refItem.url}
            alt={refItem.label}
            draggable={false}
            className="size-full object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[11px] text-white/40">
            图
          </div>
        )}
        <DockRefCornerBadge
          label={String(index + 1)}
          title="移除参考图"
          disabled={disabled}
          onRemove={onRemove}
          fontSizePx={badgeFontPx}
          minSizePx={badgeMinPx}
        />
      </div>
      <MentionHoverPreviewPortal
        item={hover ? mentionItem : null}
        anchorRect={hover?.rect ?? null}
        pointerX={hover?.clientX}
        pointerY={hover?.clientY}
        placement="above-pointer"
      />
    </>
  );
}

/** 输入坞 · 参考图 chip 行（粘贴 / 上传） */
export function Pro2DockRefImages({
  refs,
  onChange,
  disabled,
  pasteActive = true,
  maxCount = 6,
  activeIds = [],
  promptValue,
  onPromptChange,
  spawnAnchor,
}: Pro2DockRefImagesProps) {
  const base = useBookMallBaseUrl();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pasteZoneActive, setPasteZoneActive] = useState(false);
  const addNode = useCanvasStore((s) => s.addNode);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { thumbPx, thumbStyle, logoIconPx, badgeFontPx, badgeMinPx } =
    useLibtvDockRefThumbMetrics();

  const spawnFiles = useCallback(
    async (files: File[]) => {
      if (disabled || !base || !spawnAnchor || !files.length) return;
      const state = useCanvasStore.getState();
      if (spawnAnchor.nodeType === "sbv1-image") {
        await spawnSbv1ImageDockPastedImages({
          anchorNodeId: spawnAnchor.nodeId,
          files,
          base,
          nodes: state.nodes,
          edges: state.edges,
          addNode,
          setEdges,
          updateNodeData,
          setNodes,
          maxCount,
        });
        return;
      }
      await spawnPro2DockPastedImages({
        anchorNodeId: spawnAnchor.nodeId,
        anchorNodeType: spawnAnchor.nodeType,
        files,
        base,
        nodes: state.nodes,
        edges: state.edges,
        addNode,
        setEdges,
        updateNodeData,
        setNodes,
        maxCount: maxCount,
      });
    },
    [
      base,
      disabled,
      spawnAnchor,
      addNode,
      setEdges,
      setNodes,
      updateNodeData,
      maxCount,
    ],
  );

  const addRefFiles = useCallback(
    async (files: File[]) => {
      if (disabled || !base) return;
      if (spawnAnchor) {
        await spawnFiles(files);
        return;
      }
      const images = files.filter((f) => f.type.startsWith("image/"));
      const room = maxCount - refs.length;
      if (!images.length || room <= 0) return;
      const added: StoryRefImage[] = [];
      for (const file of images.slice(0, room)) {
        const url = await uploadCanvasImage(base, file);
        added.push({
          id: `ref-dock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: file.name.replace(/\.[^.]+$/, "") || "参考图",
          url,
        });
      }
      onChange([...refs, ...added]);
    },
    [base, disabled, spawnAnchor, spawnFiles, maxCount, refs, onChange],
  );

  useImagePasteWhenActive(
    Boolean(pasteActive && pasteZoneActive && !disabled && !spawnAnchor),
    { onFiles: (files) => void addRefFiles(files) },
    true,
    "pro2-dock-ref",
  );

  return (
    <div
      className="pro2-dock-ref-zone nodrag flex flex-wrap items-center gap-1.5"
      onMouseEnter={() => setPasteZoneActive(true)}
      onMouseLeave={() => setPasteZoneActive(false)}
      onFocusCapture={() => setPasteZoneActive(true)}
      onBlurCapture={() => setPasteZoneActive(false)}
    >
      {refs.map((ref, index) => (
        <DockRefImageChip
          key={ref.id}
          refItem={ref}
          index={index}
          active={activeIds.includes(ref.id)}
          disabled={disabled}
          thumbStyle={thumbStyle}
          badgeFontPx={badgeFontPx}
          badgeMinPx={badgeMinPx}
          onRemove={() => {
            const next = removeDockRefFromState(refs, ref.id, promptValue ?? "");
            onChange(next.refs);
            if (
              onPromptChange &&
              promptValue != null &&
              next.prompt !== promptValue
            ) {
              onPromptChange(next.prompt);
            }
          }}
        />
      ))}
      {spawnAnchor || refs.length < maxCount ? (
        <button
          type="button"
          style={{
            width: thumbPx,
            height: thumbPx,
            minWidth: thumbPx,
            minHeight: thumbPx,
          }}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border border-dashed border-white/[0.1] text-white/40 transition hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-white/70",
            disabled && "cursor-not-allowed opacity-40",
          )}
          title={
            spawnAnchor
              ? "上传或粘贴参考图（生成左侧图片节点）"
              : "上传或粘贴参考图"
          }
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus style={{ width: logoIconPx, height: logoIconPx }} />
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addRefFiles(files);
        }}
      />
    </div>
  );
}
