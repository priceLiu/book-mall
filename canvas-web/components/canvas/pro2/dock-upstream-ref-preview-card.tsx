"use client";

import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { MentionHoverPreviewPortal } from "@/components/canvas/mentions/mention-hover-preview";
import {
  SBV1_DOCK_ACTIVE_REF_BORDER_CLASS,
  SBV1_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { SBV1_REF_THUMB_CLASS } from "@/lib/canvas/sbv1-node-chrome";
import type { PortraitImportUiState } from "@/lib/canvas/portrait-node-data";
import { cn } from "@/lib/utils";

export function DockUpstreamRefPreviewCard({
  id,
  label,
  previewUrl,
  active,
  importBadge,
  onDisconnect,
  className,
}: {
  id: string;
  label: string;
  previewUrl?: string;
  active: boolean;
  importBadge?: PortraitImportUiState | null;
  onDisconnect: () => void;
  className?: string;
}) {
  const [hover, setHover] = useState<{
    rect: DOMRect;
    clientX: number;
    clientY: number;
  } | null>(null);

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
          SBV1_REF_THUMB_CLASS,
          "group border-2 transition-shadow",
          active ? SBV1_DOCK_ACTIVE_REF_BORDER_CLASS : SBV1_DOCK_REF_IDLE_BORDER_CLASS,
          className,
        )}
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
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-white/30">
            <ImageIcon className="size-4" />
          </div>
        )}
        <p className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-black/65 px-1 py-0.5 text-[9px] text-white/80">
          {label}
        </p>
        {importBadge === "active" ? (
          <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-emerald-600/90 px-1 py-px text-[8px] font-medium text-white">
            已入库
          </span>
        ) : importBadge === "pending" ? (
          <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-amber-600/90 px-1 py-px text-[8px] font-medium text-white">
            入库中
          </span>
        ) : importBadge === "failed" || importBadge === "missing" ? (
          previewUrl ? (
            <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-rose-600/90 px-1 py-px text-[8px] font-medium text-white">
              未入库
            </span>
          ) : null
        ) : null}
        <button
          type="button"
          className="nodrag absolute right-0.5 top-0.5 z-10 flex size-4 items-center justify-center rounded bg-black/80 text-white/85 shadow-sm transition hover:bg-black hover:text-white"
          title="断开连线"
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
        >
          <X className="size-2.5" />
        </button>
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
