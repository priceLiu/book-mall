"use client";

import { useState } from "react";
import { Check, ImageIcon, Loader2, X } from "lucide-react";
import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { MentionHoverPreviewPortal } from "@/components/canvas/mentions/mention-hover-preview";
import {
  SBV1_DOCK_ACTIVE_REF_BORDER_CLASS,
  SBV1_DOCK_REF_IDLE_BORDER_CLASS,
} from "@/lib/canvas/dock-active-ref-chrome";
import { SBV1_REF_THUMB_CLASS } from "@/lib/canvas/sbv1-node-chrome";
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
          "group border transition-shadow",
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
        <p className="pointer-events-none absolute bottom-0 left-0 right-0 truncate bg-black/65 px-1 py-0.5 text-[8px] text-white/80">
          {label}
        </p>
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
        <button
          type="button"
          className="nodrag absolute right-0.5 top-0.5 z-10 flex size-4 items-center justify-center text-white/90 opacity-0 transition hover:text-white group-hover:opacity-100"
          title="断开连线"
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
        >
          <X className={cn("size-2.5", THUMB_ICON_SHADOW)} strokeWidth={2.5} />
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
