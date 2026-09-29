"use client";

import type { EcomCopyOverlay, EcomCopyOverlayLayer } from "./types";

type Props = {
  overlay: EcomCopyOverlay;
  selectedLayer: EcomCopyOverlayLayer | undefined;
  onChange: (overlay: EcomCopyOverlay) => void;
  className?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function EcomCopyOverlayLayerControls({
  overlay,
  selectedLayer,
  onChange,
  className = "",
}: Props) {
  if (!selectedLayer) return null;

  const patchLayer = (patch: Partial<EcomCopyOverlayLayer>) => {
    onChange({
      ...overlay,
      layers: overlay.layers.map((l) =>
        l.id === selectedLayer.id ? { ...l, ...patch } : l,
      ),
    });
  };

  return (
    <div className={`grid grid-cols-2 gap-2 text-xs ${className}`}>
      <label className="text-[#6e6e73]">
        文本框宽度（占图宽 %）
        <input
          type="number"
          min={12}
          max={96}
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={Math.round((selectedLayer.maxWidthNorm ?? 0.88) * 100)}
          onChange={(e) =>
            patchLayer({
              maxWidthNorm: clamp(Number(e.target.value) / 100, 0.12, 0.96),
            })
          }
        />
      </label>
      <label className="text-[#6e6e73]">
        字号（成图像素）
        <input
          type="number"
          min={12}
          max={120}
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={selectedLayer.fontSize}
          onChange={(e) => patchLayer({ fontSize: Number(e.target.value) || 32 })}
        />
      </label>
      <label className="text-[#6e6e73]">
        颜色
        <input
          type="color"
          className="mt-0.5 h-8 w-full cursor-pointer rounded border border-[#d2d2d7]"
          value={selectedLayer.color ?? "#ffffff"}
          onChange={(e) => patchLayer({ color: e.target.value })}
        />
      </label>
      <label className="col-span-2 text-[#6e6e73]">
        排版方向
        <select
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={selectedLayer.writingMode ?? "horizontal"}
          onChange={(e) =>
            patchLayer({
              writingMode: e.target.value === "vertical" ? "vertical" : "horizontal",
            })
          }
        >
          <option value="horizontal">横排</option>
          <option value="vertical">竖排</option>
        </select>
      </label>
      <label className="text-[#6e6e73]">
        对齐
        <select
          className="mt-0.5 w-full rounded border border-[#d2d2d7] px-2 py-1"
          value={selectedLayer.textAlign ?? "center"}
          onChange={(e) =>
            patchLayer({
              textAlign: e.target.value as "left" | "center" | "right",
            })
          }
        >
          <option value="left">左</option>
          <option value="center">中</option>
          <option value="right">右</option>
        </select>
      </label>
    </div>
  );
}
