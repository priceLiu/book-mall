"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LogInputImageItem } from "@/lib/gateway-log-params";
import { extractLogInputImages } from "@/lib/gateway-log-params";
import { useLogHoverTip } from "./use-log-hover-tip";

const MAX_VISIBLE = 6;

function LogImageHoverPreview({
  item,
  pos,
  bindTip,
}: {
  item: LogInputImageItem;
  pos: { top: number; left: number };
  bindTip: () => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="gw-log-preview-tip gw-log-image-preview-tip"
      style={{
        top: pos.top,
        left: pos.left,
        width: "min(480px, calc(100vw - 32px))",
      }}
      {...bindTip()}
      role="dialog"
      aria-label={`${item.label} 预览`}
    >
      <div className="border-b border-white/[0.08] px-4 py-2.5">
        <div className="font-mono text-xs font-medium text-white">{item.label}</div>
        {item.role ? (
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">{item.role}</div>
        ) : null}
      </div>
      <div className="gw-log-preview-tip__body flex items-center justify-center p-3">
        {failed ? (
          <span className="py-12 text-sm text-zinc-500">无法加载预览</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.label}
            className="max-h-[min(520px,70vh)] w-full rounded-md object-contain bg-black/30"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div className="border-t border-white/[0.08] px-4 py-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all font-mono text-[10px] leading-snug text-sky-400/90 hover:text-sky-300"
        >
          {item.url}
        </a>
      </div>
    </div>
  );
}

function LogImageThumb({ item }: { item: LogInputImageItem }) {
  const [failed, setFailed] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const { open, pos, bindAnchor, bindTip } = useLogHoverTip({
    tipWidth: 480,
    tipMaxH: 640,
    enabled: !failed,
  });
  const hover = bindAnchor(() => anchorRef.current?.getBoundingClientRect() ?? null);

  return (
    <>
      <a
        ref={anchorRef}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="gw-log-image-thumb group block shrink-0"
        {...hover}
      >
        <div className="gw-log-image-thumb__frame">
          {failed ? (
            <span className="text-[10px] text-zinc-500">无法预览</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.label}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
              onError={() => setFailed(true)}
            />
          )}
        </div>
        <span className="gw-log-image-thumb__label">{item.label}</span>
      </a>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <LogImageHoverPreview item={item} pos={pos} bindTip={bindTip} />,
            document.body,
          )
        : null}
    </>
  );
}

export function LogImagesCell({ inputSummary }: { inputSummary: unknown }) {
  const images = extractLogInputImages(inputSummary);

  if (!images.length) {
    return <span className="text-sm text-zinc-600">—</span>;
  }

  const visible = images.slice(0, MAX_VISIBLE);
  const rest = images.length - visible.length;

  return (
    <div className="gw-log-images-cell">
      <div className="gw-log-images-cell__row gw-scrollbar-thin">
        {visible.map((item, i) => (
          <LogImageThumb key={`${item.url}-${i}`} item={item} />
        ))}
        {rest > 0 ? (
          <div className="flex shrink-0 flex-col items-center justify-center px-1">
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-zinc-400">
              +{rest}
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-1 font-mono text-[10px] text-zinc-600">
        {images.length} 张参考图 · 悬停放大
      </div>
    </div>
  );
}
