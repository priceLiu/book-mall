"use client";

import Image from "next/image";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import type {
  StoryCharacterColumnRow,
  StoryFrameColumnRow,
} from "@/lib/canvas/story-column-bindings";

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "running" ?
      "bg-amber-500/20 text-amber-200"
    : status === "done" ?
      "bg-emerald-500/15 text-emerald-200"
    : status === "error" ?
      "bg-red-500/20 text-red-200"
    : "bg-white/5 text-[var(--canvas-muted)]";
  const label =
    status === "running" ?
      "生成中"
    : status === "done" ?
      "已完成"
    : status === "error" ?
      "失败"
    : "待生成";
  return (
    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px]", cls)}>
      {label}
    </span>
  );
}

function MediaThumb({
  url,
  alt,
  emptyLabel,
}: {
  url?: string;
  alt: string;
  emptyLabel: string;
}) {
  if (url) {
    return (
      <div className="relative h-[88px] w-[140px] shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50">
        <Image src={url} alt={alt} fill className="object-contain" unoptimized />
      </div>
    );
  }
  return (
    <div className="flex h-[88px] w-[140px] shrink-0 items-center justify-center rounded-md border border-dashed border-white/15 bg-black/30 text-[10px] text-[var(--canvas-muted)]">
      {emptyLabel}
    </div>
  );
}

export function StoryCharacterColumnPanel({
  rows,
  onRegenerateRow,
  busyKey,
}: {
  rows: StoryCharacterColumnRow[];
  onRegenerateRow?: (row: StoryCharacterColumnRow) => void;
  busyKey?: string | null;
}) {
  if (!rows.length) {
    return (
      <p className="text-[11px] text-[var(--canvas-muted)]">
        完成角色设定文案后，点击底栏「生成三视图」批量出图。
      </p>
    );
  }

  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1",
        RF_NODE_SCROLL,
      )}
    >
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex gap-2 rounded-lg border border-white/10 bg-black/25 p-2"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[12px] font-medium text-white">{row.name}</span>
              <StatusPill status={row.status} />
            </div>
            {row.role ? (
              <p className="mb-1 line-clamp-3 text-[10px] leading-relaxed text-white/55">
                {row.role}
              </p>
            ) : null}
            <p className="line-clamp-4 text-[10px] leading-relaxed text-white/70">
              {row.appearance}
            </p>
            {onRegenerateRow && row.threeViewNodeId ? (
              <button
                type="button"
                className="nodrag mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#fb923c] hover:text-[#fdba74]"
                disabled={busyKey === row.key || row.status === "running"}
                onClick={() => onRegenerateRow(row)}
              >
                {busyKey === row.key || row.status === "running" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                重新生成三视图
              </button>
            ) : null}
          </div>
          <MediaThumb url={row.imageUrl} alt={row.name} emptyLabel="三视图" />
        </div>
      ))}
    </div>
  );
}

export function StoryFrameColumnPanel({
  rows,
  onOpenRow,
  busyKey,
}: {
  rows: StoryFrameColumnRow[];
  onOpenRow?: (row: StoryFrameColumnRow) => void;
  busyKey?: string | null;
}) {
  if (!rows.length) {
    return (
      <p className="text-[11px] text-[var(--canvas-muted)]">
        完成分镜脚本后，在「角色设定」点「生成分镜」创建分镜图节点。
      </p>
    );
  }

  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1",
        RF_NODE_SCROLL,
      )}
    >
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          className="nodrag flex w-full gap-2 rounded-lg border border-white/10 bg-black/25 p-2 text-left hover:border-[#fb923c]/40"
          onClick={() => onOpenRow?.(row)}
          disabled={!onOpenRow}
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[12px] font-medium text-white">
                镜 {row.frameIndex}
              </span>
              <StatusPill status={row.status} />
              {busyKey === row.key ? (
                <Loader2 className="size-3 animate-spin text-amber-200" />
              ) : null}
            </div>
            <p className="line-clamp-2 text-[10px] text-white/65">
              {row.scene || row.description}
            </p>
            {row.dialogue ? (
              <p className="mt-0.5 line-clamp-1 text-[10px] text-white/45">
                对白：{row.dialogue}
              </p>
            ) : null}
          </div>
          <MediaThumb url={row.imageUrl} alt={`镜${row.frameIndex}`} emptyLabel="分镜图" />
        </button>
      ))}
    </div>
  );
}
