"use client";

import { ImageIcon } from "lucide-react";
import type { Sbv1RefSlot, Sbv1ReferenceMode } from "@/lib/canvas/sbv1-workspace-types";
import type { Sbv1UpstreamRefLink } from "@/lib/canvas/sbv1-upstream-ref-links";

export function Sbv1RefContentSlots({
  mode,
  upstreamLinks,
  refSlots,
}: {
  mode: Sbv1ReferenceMode;
  upstreamLinks: Sbv1UpstreamRefLink[];
  refSlots: Sbv1RefSlot[];
}) {
  if (mode === "omni") {
    return (
      <div className="px-3 py-2 text-[11px] text-white/45">
        {upstreamLinks.length
          ? `已连接 ${upstreamLinks.length} 张参考图，可在下方 prompt 中用 @图片N 引用。`
          : "连接图片节点或粘贴参考图后，在此编写视频描述。"}
      </div>
    );
  }

  if (mode === "first_last") {
    const first = upstreamLinks[0];
    const last = upstreamLinks[1];
    return (
      <div className="grid grid-cols-2 gap-2 px-3 py-2">
        <FrameSlot label="首帧" link={first} />
        <FrameSlot label="尾帧" link={last} />
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-2">
      {(refSlots.length ? refSlots : [{ slotId: "1" }]).map((slot, i) => (
        <div
          key={slot.slotId}
          className="flex items-center gap-2 rounded-lg border border-dashed border-white/12 px-2 py-1.5"
        >
          <span className="text-[10px] text-white/40">第 {i + 1} 帧</span>
          {upstreamLinks[i]?.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={upstreamLinks[i]!.previewUrl}
              alt=""
              className="size-8 rounded object-cover"
            />
          ) : (
            <ImageIcon className="size-4 text-white/25" />
          )}
        </div>
      ))}
      <p className="text-[10px] text-white/35">
        智能多帧：按连线顺序取图；Phase 1 近似多图参考生成。
      </p>
    </div>
  );
}

function FrameSlot({
  label,
  link,
}: {
  label: string;
  link?: Sbv1UpstreamRefLink;
}) {
  return (
    <div className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/12 bg-white/[0.02] p-2">
      <span className="text-[10px] text-white/45">{label}</span>
      {link?.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.previewUrl}
          alt={link.label}
          className="max-h-14 w-full rounded object-contain"
        />
      ) : (
        <ImageIcon className="size-5 text-white/20" />
      )}
    </div>
  );
}
