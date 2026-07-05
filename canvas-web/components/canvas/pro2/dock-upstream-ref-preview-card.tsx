"use client";

import { useState } from "react";
import { Check, ImageIcon, Loader2 } from "lucide-react";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { MentionHoverPreviewPortal } from "@/components/canvas/mentions/mention-hover-preview";
import { DockRefCornerBadge } from "@/components/canvas/pro2/dock-ref-corner-badge";
import {
  SBV1_DOCK_ACTIVE_REF_BORDER_CLASS,
  SBV1_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { SBV1_REF_THUMB_BASE_CLASS, SBV1_REF_THUMB_CLASS } from "@/lib/canvas/sbv1-node-chrome";
import { setMentionDragData } from "@/lib/canvas/mention-drag";
import type { PortraitImportUiState } from "@/lib/canvas/portrait-node-data";
import { cn } from "@/lib/utils";

const THUMB_ICON_SHADOW =
  "drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]";

export function DockUpstreamRefPreviewCard({
  id,
  label,
  previewUrl,
  active,
  importBadge,
  cornerLabel,
  badgeIndex,
  showCornerBadge = true,
  onDisconnect,
  className,
  style,
  badgeFontPx,
  badgeMinPx,
}: {
  id: string;
  label: string;
  previewUrl?: string;
  active: boolean;
  importBadge?: PortraitImportUiState | null;
  /** 右上角角标：首尾帧等角色文案，或非首尾帧时的序号 */
  cornerLabel?: string;
  /** cornerLabel 未传时回退为 index+1 */
  badgeIndex?: number;
  /** 无画布连线时不显示右上角角标 */
  showCornerBadge?: boolean;
  onDisconnect: () => void;
  className?: string;
  style?: React.CSSProperties;
  badgeFontPx?: number;
  badgeMinPx?: number;
}) {
  const [hover, setHover] = useState<{
    rect: DOMRect;
    clientX: number;
    clientY: number;
  } | null>(null);

  const badgeText =
    cornerLabel?.trim() ||
    (badgeIndex != null ? String(badgeIndex + 1) : undefined);

  const mentionItem: MentionableItem = {
    id,
    label,
    kind: "image",
    previewUrl,
  };

  return (
    <>
      <div
        className={cn(
          style ? SBV1_REF_THUMB_BASE_CLASS : SBV1_REF_THUMB_CLASS,
          "group cursor-grab border transition-shadow active:cursor-grabbing",
          active ? SBV1_DOCK_ACTIVE_REF_BORDER_CLASS : SBV1_DOCK_REF_IDLE_BORDER_CLASS,
          className,
        )}
        style={style}
        title={`${label} · 可拖入正文 @ 引用`}
        draggable
        onDragStart={(e) => {
          setMentionDragData(e.dataTransfer, id);
          setHover(null);
        }}
        onMouseEnter={(e) => {
          if (!previewUrl) return;
          setHover({
            rect: e.currentTarget.getBoundingClientRect(),
            clientX: e.clientX,
            clientY: e.clientY,
          });
        }}
        onMouseMove={(e) => {
          if (!previewUrl) return;
          setHover({
            rect: e.currentTarget.getBoundingClientRect(),
            clientX: e.clientX,
            clientY: e.clientY,
          });
        }}
        onMouseLeave={() => setHover(null)}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-white/30">
            <ImageIcon className="size-4" />
          </div>
        )}
        {badgeText && showCornerBadge ? (
          <DockRefCornerBadge
            label={badgeText}
            title="断开连线"
            onRemove={onDisconnect}
            fontSizePx={badgeFontPx}
            minSizePx={badgeMinPx}
          />
        ) : null}
        {importBadge === "pending" ? (
          <span
            className="pointer-events-none absolute left-0.5 top-0.5 flex size-4 items-center justify-center"
            title="私域人像入库中…"
          >
            <Loader2
              className={cn("size-2.5 animate-spin text-cyan-300/90", THUMB_ICON_SHADOW)}
            />
          </span>
        ) : importBadge === "active" ? (
          <span
            className="pointer-events-none absolute left-0.5 top-0.5 flex size-4 items-center justify-center"
            title="已入库 · 生视频将引用 asset://"
            aria-label="已入库"
          >
            <Check
              className={cn("size-2.5 text-emerald-400", THUMB_ICON_SHADOW)}
              strokeWidth={2.5}
            />
          </span>
        ) : importBadge === "failed" || importBadge === "missing" ? (
          previewUrl ? (
            <span
              className="pointer-events-none absolute left-0.5 top-0.5 text-[8px] font-medium leading-none text-rose-300"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
            >
              !
            </span>
          ) : null
        ) : null}
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
