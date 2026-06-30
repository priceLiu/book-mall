"use client";

import { useCallback, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import type { Sbv1UpstreamRefLink } from "@/lib/canvas/sbv1-upstream-ref-links";
import { useCanvasStore } from "@/lib/canvas/store";
import { cn } from "@/lib/utils";

function Sbv1RefChip({
  link,
  onDisconnect,
}: {
  link: Sbv1UpstreamRefLink;
  onDisconnect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] pr-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="flex size-5 items-center justify-center rounded-l-md bg-cyan-500/25 text-[10px] font-semibold text-cyan-100">
        {link.index}
      </span>
      {link.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.previewUrl}
          alt={link.label}
          className="size-7 rounded object-cover"
        />
      ) : (
        <span className="flex size-7 items-center justify-center text-white/30">
          <ImageIcon className="size-3.5" />
        </span>
      )}
      <span className="max-w-[72px] truncate text-[10px] text-white/70">
        {link.label}
      </span>
      {hovered ? (
        <button
          type="button"
          className="ml-0.5 flex size-5 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
          title="断开连线（不删除图片节点）"
          onClick={onDisconnect}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export function Sbv1UpstreamRefChips({
  links,
  engineNodeId,
}: {
  links: Sbv1UpstreamRefLink[];
  engineNodeId: string;
}) {
  const setEdges = useCanvasStore((s) => s.setEdges);

  const onDisconnect = useCallback(
    (link: Sbv1UpstreamRefLink) => {
      setEdges((es) => es.filter((e) => e.id !== link.edgeId));
    },
    [setEdges],
  );

  if (!links.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5")}>
      {links.map((link) => (
        <Sbv1RefChip
          key={link.id}
          link={link}
          onDisconnect={() => onDisconnect(link)}
        />
      ))}
    </div>
  );
}
