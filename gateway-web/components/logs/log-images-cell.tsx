"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LogInputImageItem } from "@/lib/gateway-log-params";
import { extractLogInputImages, readLogInputImageHint } from "@/lib/gateway-log-params";
import { useLogHoverTip } from "./use-log-hover-tip";

const MAX_VISIBLE = 6;

function assetShortLabel(url: string): string {
  const id = url.replace(/^asset:\/\//, "").trim();
  if (id.length <= 12) return id;
  return `${id.slice(0, 10)}…`;
}

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
  const previewable = item.previewable !== false;

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
        {!previewable ? (
          <div className="py-10 text-center">
            <p className="text-sm text-zinc-400">人像库 asset 引用</p>
            <p className="mt-2 break-all font-mono text-[11px] text-zinc-500">{item.url}</p>
          </div>
        ) : failed ? (
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
        {previewable ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all font-mono text-[10px] leading-snug text-sky-400/90 hover:text-sky-300"
          >
            {item.url}
          </a>
        ) : (
          <span className="block break-all font-mono text-[10px] leading-snug text-zinc-500">
            {item.url}
          </span>
        )}
      </div>
    </div>
  );
}

function LogImageThumb({ item }: { item: LogInputImageItem }) {
  const [failed, setFailed] = useState(false);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const staticRef = useRef<HTMLDivElement>(null);
  const previewable = item.previewable !== false;
  const { open, pos, bindAnchor, bindTip } = useLogHoverTip({
    tipWidth: 480,
    tipMaxH: 640,
    enabled: previewable ? !failed : true,
  });
  const hover = bindAnchor(() => {
    const el = previewable ? anchorRef.current : staticRef.current;
    return el?.getBoundingClientRect() ?? null;
  });

  const frame = (
    <div className="gw-log-image-thumb__frame">
      {!previewable ? (
        <span className="px-1 text-center font-mono text-[9px] leading-tight text-violet-300">
          asset
          <br />
          {assetShortLabel(item.url)}
        </span>
      ) : failed ? (
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
  );

  return (
    <>
      {previewable ? (
        <a
          ref={anchorRef}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="gw-log-image-thumb group block shrink-0"
          {...hover}
        >
          {frame}
          <span className="gw-log-image-thumb__label">{item.label}</span>
        </a>
      ) : (
        <div
          ref={staticRef}
          className="gw-log-image-thumb group block shrink-0 cursor-default"
          {...hover}
        >
          {frame}
          <span className="gw-log-image-thumb__label">{item.label}</span>
        </div>
      )}

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
  const hintCount = readLogInputImageHint(inputSummary);

  if (!images.length) {
    if (hintCount != null) {
      return (
        <span
          className="text-sm text-zinc-500"
          title="参考图经人像库 asset:// 提交，无公网 URL"
        >
          {hintCount} 张参考图（asset）
        </span>
      );
    }
    return <span className="text-sm text-zinc-600">—</span>;
  }

  const visible = images.slice(0, MAX_VISIBLE);
  const rest = images.length - visible.length;
  const assetCount = images.filter((i) => i.previewable === false).length;

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
        {images.length} 张参考图
        {assetCount > 0 ? ` · ${assetCount} 张 asset` : ""} · 悬停查看
      </div>
    </div>
  );
}
