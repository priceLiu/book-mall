"use client";

import { useCallback, useRef, useState } from "react";

import { normalizedBbox } from "@/lib/image-layer-coords";
import { cn } from "@/lib/utils";

type Props = {
  url: string;
  bbox: [number, number, number, number] | null;
  disabled?: boolean;
  onChange: (bbox: [number, number, number, number] | null) => void;
};

function overlayStyle(bbox: [number, number, number, number]) {
  const left = (bbox[0] / 999) * 100;
  const top = (bbox[1] / 999) * 100;
  const width = ((bbox[2] - bbox[0]) / 999) * 100;
  const height = ((bbox[3] - bbox[1]) / 999) * 100;
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` };
}

function paintedRect(img: HTMLImageElement) {
  const r = img.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw <= 0 || nh <= 0 || r.width <= 0 || r.height <= 0) return null;
  const scale = Math.min(r.width / nw, r.height / nh);
  const w = nw * scale;
  const h = nh * scale;
  return {
    left: r.left + (r.width - w) / 2,
    top: r.top + (r.height - h) / 2,
    w,
    h,
  };
}

export function RefImageBboxPicker({ url, bbox, disabled, onChange }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [paintRev, setPaintRev] = useState(0);

  const toLocal = useCallback((e: React.PointerEvent) => {
    const img = imgRef.current;
    if (!img) return null;
    const painted = paintedRect(img);
    if (!painted) return null;
    return {
      x: Math.max(0, Math.min(painted.w, e.clientX - painted.left)),
      y: Math.max(0, Math.min(painted.h, e.clientY - painted.top)),
    };
  }, []);

  const commit = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      const img = imgRef.current;
      if (!img || img.naturalWidth <= 0) return;
      const painted = paintedRect(img);
      if (!painted) return;
      if (Math.abs(x2 - x1) < 8 || Math.abs(y2 - y1) < 8) {
        onChange(null);
        return;
      }
      const sx = img.naturalWidth / painted.w;
      const sy = img.naturalHeight / painted.h;
      onChange(
        normalizedBbox(
          x1 * sx,
          y1 * sy,
          x2 * sx,
          y2 * sy,
          img.naturalWidth,
          img.naturalHeight,
        ),
      );
    },
    [onChange],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#374151]">图 2 框选（可选）</p>
        {bbox ? (
          <button
            type="button"
            disabled={disabled}
            className="text-[11px] text-[#2563eb] disabled:opacity-50"
            onClick={() => onChange(null)}
          >
            清除框
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          "w-full overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f3f4f6]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <div ref={wrapRef} className="relative w-full">
        <img
          ref={imgRef}
          src={url}
          alt="参考图"
          draggable={false}
          className="mx-auto block h-auto max-h-[min(50dvh,28rem)] w-full object-contain touch-none select-none"
          onLoad={() => setPaintRev((n) => n + 1)}
          onPointerDown={(e) => {
            if (disabled) return;
            const p = toLocal(e);
            if (!p) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = p;
            setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const p = toLocal(e);
            if (!p) return;
            setDraft({
              x1: dragRef.current.x,
              y1: dragRef.current.y,
              x2: p.x,
              y2: p.y,
            });
          }}
          onPointerUp={(e) => {
            if (!dragRef.current) return;
            const start = dragRef.current;
            dragRef.current = null;
            const p = toLocal(e) ?? start;
            setDraft(null);
            commit(start.x, start.y, p.x, p.y);
          }}
        />
        {(() => {
          void paintRev;
          const img = imgRef.current;
          const wrap = wrapRef.current;
          const painted = img ? paintedRect(img) : null;
          const wr = wrap?.getBoundingClientRect();
          const ox = painted && wr ? painted.left - wr.left : 0;
          const oy = painted && wr ? painted.top - wr.top : 0;
          if (draft) {
            return (
              <div
                className="pointer-events-none absolute border-2 border-[#2563eb] bg-[#2563eb]/15"
                style={{
                  left: ox + Math.min(draft.x1, draft.x2),
                  top: oy + Math.min(draft.y1, draft.y2),
                  width: Math.abs(draft.x2 - draft.x1),
                  height: Math.abs(draft.y2 - draft.y1),
                }}
              />
            );
          }
          if (bbox && painted) {
            return (
              <div
                className="pointer-events-none absolute"
                style={{ left: ox, top: oy, width: painted.w, height: painted.h }}
              >
                <div
                  className="absolute border-2 border-[#2563eb] bg-[#2563eb]/10"
                  style={overlayStyle(bbox)}
                />
              </div>
            );
          }
          return null;
        })()}
        </div>
      </div>
      <p className="text-[11px] leading-4 text-[#9ca3af]">
        在参考图上拖选主体或场景区域，对应官方「图 2 &lt;bbox&gt;」。
      </p>
    </div>
  );
}
