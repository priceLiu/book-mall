"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import type { CanvasNodeRuntime } from "@/lib/canvas/types";
import { NodeStatusBadge } from "./node-shell";
import { MarkdownFullscreenLightbox } from "./markdown-fullscreen-lightbox";
import { MediaPreviewLightbox } from "./media-hover-box";
import { AudioFullscreenLightbox } from "./audio-fullscreen-lightbox";

export type EnginePreviewKind = "markdown" | "image" | "video" | "audio";

export function EnginePreviewTrigger({
  title,
  kind,
  content,
  mediaUrl,
  status,
  failMessage,
  extra,
}: {
  title: string;
  kind: EnginePreviewKind;
  content?: string;
  mediaUrl?: string;
  status?: CanvasNodeRuntime["status"];
  failMessage?: string | null;
  /** 标题栏左侧额外按钮（复制、批量等） */
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const disabled =
    kind === "markdown"
      ? !content?.trim()
      : !mediaUrl?.trim();

  return (
    <>
      <div className="flex items-center gap-1">
        {extra}
        <NodeStatusBadge
          status={status ?? "idle"}
          message={failMessage ?? null}
        />
        <button
          type="button"
          disabled={disabled}
          title="全屏预览"
          className="nodrag inline-flex items-center justify-center rounded border border-white/15 p-1 text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Eye className="size-3.5" />
        </button>
      </div>

      {open && kind === "markdown" ? (
        <MarkdownFullscreenLightbox
          title={title}
          content={content ?? ""}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {open && kind === "image" && mediaUrl ? (
        <MediaPreviewLightbox
          src={mediaUrl}
          kind="image"
          alt={title}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {open && kind === "video" && mediaUrl ? (
        <MediaPreviewLightbox
          src={mediaUrl}
          kind="video"
          alt={title}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {open && kind === "audio" && mediaUrl ? (
        <AudioFullscreenLightbox
          title={title}
          src={mediaUrl}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
