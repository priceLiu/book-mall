"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";

import { useCanvasStore } from "@/lib/canvas/store";
import { directPredecessors } from "@/lib/canvas/topo";
import type {
  AiEngineNodeData,
  ImageEngineNodeData,
  ImageNodeData,
  TextNodeData,
} from "@/lib/canvas/types";
import {
  isVideoMediaUrl,
  MediaPreviewLightbox,
} from "./media-hover-box";

export type UpstreamChipKind = "image" | "text";

export type UpstreamChip = {
  /** 上游节点 id */
  id: string;
  /** 显示在 chip 上的短标签（如 "图 · 1.png"） */
  label: string;
  kind: UpstreamChipKind;
  /** 缩略图 URL（image / image-engine 输出） */
  thumb?: string;
  /** 完整文本（text / ai-engine 输出），用于 hover 出全文 */
  fullText?: string;
};

/**
 * 把上游节点抽象为 chip：
 * - image → 缩略图 + 文件名
 * - image-engine → 取 runtime.ossUrl 缩略图
 * - text → 全文 hover；chip 上展示头部
 * - ai-engine → 取 runtime.textOutput
 */
export function useUpstreamChips(nodeId: string): UpstreamChip[] {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  return useMemo<UpstreamChip[]>(() => {
    const ids = directPredecessors(edges, nodeId);
    const out: UpstreamChip[] = [];
    for (const pid of ids) {
      const p = nodes.find((n) => n.id === pid);
      if (!p) continue;
      const t = p.type;
      if (t === "image") {
        const dd = p.data as ImageNodeData;
        const thumb = dd.ossUrl || dd.blobUrl;
        out.push({
          id: pid,
          kind: "image",
          label: dd.label?.trim() || `图片-${pid.slice(-4)}`,
          thumb,
        });
      } else if (t === "image-engine" || t === "three-view-engine") {
        const dd = p.data as ImageEngineNodeData;
        const thumb = dd.runtime?.ossUrl;
        out.push({
          id: pid,
          kind: "image",
          label:
            t === "three-view-engine"
              ? `三视图 · ${pid.slice(-4)}`
              : `生图 · ${pid.slice(-4)}`,
          thumb,
        });
      } else if (t === "text") {
        const dd = p.data as TextNodeData;
        const full = dd.text ?? "";
        out.push({
          id: pid,
          kind: "text",
          label: `文 · ${full.slice(0, 12) || pid.slice(-4)}`,
          fullText: full,
        });
      } else if (t === "ai-engine") {
        const dd = p.data as AiEngineNodeData;
        const full = dd.runtime?.textOutput ?? "";
        out.push({
          id: pid,
          kind: "text",
          label: full
            ? `AI · ${full.slice(0, 12)}`
            : `AI · ${pid.slice(-4)}`,
          fullText: full,
        });
      } else {
        out.push({
          id: pid,
          kind: "text",
          label: `${t ?? "节点"} · ${pid.slice(-4)}`,
        });
      }
    }
    return out;
  }, [nodes, edges, nodeId]);
}

/** 图片 chip 在前，文本 / 参数 chip 永远排在最后（同类型内保持入边顺序） */
export function sortUpstreamChips(chips: UpstreamChip[]): UpstreamChip[] {
  const images: UpstreamChip[] = [];
  const texts: UpstreamChip[] = [];
  for (const c of chips) {
    if (c.kind === "image") images.push(c);
    else texts.push(c);
  }
  return [...images, ...texts];
}

/**
 * 上游 chip 行：图带缩略图、文本 hover 出全文。
 *
 * 已被 `referenced` 集合命中的 chip 带高亮边框；其他 chip 暗显，提示用户可在
 * prompt 输入 `@` 直接引用。
 */
export function UpstreamChipRow({
  chips,
  referenced,
  className,
}: {
  chips: UpstreamChip[];
  referenced: string[];
  className?: string;
}) {
  if (!chips.length) return null;
  const refSet = new Set(referenced);
  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {chips.map((c) => {
        const used = refSet.has(c.id);
        const baseCls = used
          ? "border-[var(--canvas-accent)]/60 bg-[var(--canvas-accent)]/10 text-white"
          : "border-white/10 bg-white/5 text-white/55";
        return (
          <div
            key={c.id}
            className={`group relative inline-flex items-center gap-1 rounded border px-1 py-0.5 text-[10px] ${baseCls}`}
            title={used ? "已被 prompt 引用" : "未引用，可在下方输入 @ 引用"}
          >
            {c.kind === "image" && c.thumb ? (
              <ChipMediaThumb src={c.thumb} label={c.label} />
            ) : c.kind === "image" ? (
              <span className="grid h-5 w-5 place-items-center rounded bg-white/10 text-[8px] text-white/50">
                IMG
              </span>
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded bg-white/10 text-[8px] text-white/60">
                T
              </span>
            )}
            <span className="max-w-[160px] truncate">
              @{c.label}
            </span>
            {/* 文本 hover 全文 */}
            {c.fullText ? (
              <div
                className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden max-h-64 w-64 overflow-auto rounded-md border border-white/10 bg-[var(--canvas-surface)] p-2 text-[10px] leading-relaxed text-white/80 shadow-xl group-hover:block"
                role="tooltip"
              >
                <pre className="whitespace-pre-wrap break-words font-sans">
                  {c.fullText}
                </pre>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** chip 内小缩略图：hover 显示预览 logo，点击打开全屏预览 */
function ChipMediaThumb({ src, label }: { src: string; label: string }) {
  const [open, setOpen] = useState(false);
  const kind = isVideoMediaUrl(src) ? "video" : "image";
  return (
    <>
      <button
        type="button"
        className="group/chip relative h-5 w-5 shrink-0 overflow-hidden rounded"
        title="预览"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {kind === "video" ? (
          <video
            src={src}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/chip:bg-black/50 group-hover/chip:opacity-100">
          <Eye className="size-3 text-white" />
        </span>
      </button>
      {open ? (
        <MediaPreviewLightbox
          src={src}
          kind={kind}
          alt={label}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
