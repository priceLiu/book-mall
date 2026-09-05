"use client";

/**
 * 作品墙自由画布 · 挂件公共件
 *
 * 所有挂件的 View / Inspector 都从这里取 props 类型与基础组件。
 * 性能约束（见 doc/product/AI 空间功能设计文档.md §7.3）：
 * 图片一律走 thumbnailUrl + lazy；视频/音频进视口才挂载真实媒体元素。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import type {
  AiSpaceBlockDto,
  AiSpaceBlockRefDto,
} from "@/lib/ai-space/ai-space-space-types";
import type { SpaceThemeTokens } from "@/lib/ai-space/space-blocks/theme";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------

/** 名片挂件要读页面级信息，因此放进公共 props 保持所有 View 同签名 */
export type SpacePageContext = {
  pageTitle: string;
  pageBio: string;
};

export type SpaceBlockViewProps = {
  block: AiSpaceBlockDto;
  /** 公开页为 true：不显示编辑引导，不渲染深链 */
  readOnly: boolean;
  theme: SpaceThemeTokens;
  accent: string;
  page: SpacePageContext;
  /** 点击图片放大；公开页与编辑页共用 */
  onOpenLightbox?: (refs: AiSpaceBlockRefDto[], index: number) => void;
};

export type SpaceBlockInspectorProps = {
  block: AiSpaceBlockDto;
  /** 合并进 config 后提交 */
  onConfigChange: (patch: Record<string, unknown>) => void;
  onContentChange: (text: string) => void;
};

/** 从块 config 上取值（config 已由服务端 parseConfig 规范化） */
export function readConfig<T>(block: AiSpaceBlockDto, key: string, fallback: T): T {
  const v = block.config[key];
  return v === undefined ? fallback : (v as T);
}

export function refsForSlot(
  block: AiSpaceBlockDto,
  slotKey: string,
): AiSpaceBlockRefDto | null {
  return block.refs.find((r) => r.slotKey === slotKey) ?? null;
}

// ---------------------------------------------------------------------------
// 占位
// ---------------------------------------------------------------------------

export function SpaceEmptySlot({
  label,
  readOnly,
  theme,
  className,
}: {
  label: string;
  readOnly: boolean;
  theme: SpaceThemeTokens;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed p-3 text-center",
        className,
      )}
      style={{ borderColor: theme.border, color: theme.mutedText }}
    >
      <p className="text-xs">{label}</p>
      {readOnly ? null : <p className="text-[11px] opacity-70">从右侧素材抽屉拖入</p>}
    </div>
  );
}

/** 源素材已被原应用删除：保留块，提示用户清理 */
export function SpaceMissingAsset({
  readOnly,
  theme,
}: {
  readOnly: boolean;
  theme: SpaceThemeTokens;
}) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed p-3 text-center"
      style={{ borderColor: theme.border, color: theme.mutedText }}
    >
      <p className="text-xs">素材已删除</p>
      {readOnly ? null : (
        <p className="text-[11px] opacity-70">原应用中已移除，可换一个素材</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 媒体
// ---------------------------------------------------------------------------

/** 进视口才为真的 hook：视频/音频延迟挂载，避免一页几十个媒体元素同时加载 */
export function useInView<T extends HTMLElement>(): [
  React.RefObject<T>,
  boolean,
] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  return [ref, inView];
}

export function SpaceImage({
  assetRef,
  fit = "cover",
  className,
  onClick,
}: {
  assetRef: AiSpaceBlockRefDto | null | undefined;
  fit?: "cover" | "contain";
  className?: string;
  onClick?: () => void;
}) {
  if (!assetRef) return null;
  const resolved = assetRef.resolved;
  if (!resolved) return null;
  const src = resolved.thumbnailUrl ?? resolved.mediaUrl;
  const alt = assetRef.caption ?? resolved.title ?? "作品";
  return (
    // 作品图为 OSS 任意尺寸，走原生 img 避免 next/image 域名白名单维护
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onClick={onClick}
      className={cn(
        "h-full w-full",
        fit === "contain" ? "object-contain" : "object-cover",
        onClick ? "cursor-zoom-in" : null,
        className,
      )}
    />
  );
}

export function SpaceVideo({
  assetRef,
  fit = "contain",
  loop = false,
  muted = true,
  autoplay = false,
  className,
}: {
  assetRef: AiSpaceBlockRefDto | null | undefined;
  fit?: "cover" | "contain";
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  className?: string;
}) {
  const [holderRef, inView] = useInView<HTMLDivElement>();
  if (!assetRef) return null;
  const resolved = assetRef.resolved;
  if (!resolved) return null;

  return (
    <div ref={holderRef} className={cn("h-full w-full bg-black", className)}>
      {inView ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          className={cn(
            "h-full w-full",
            fit === "cover" ? "object-cover" : "object-contain",
          )}
          controls
          preload="none"
          loop={loop}
          muted={muted}
          autoPlay={autoplay && muted}
          playsInline
          poster={resolved.thumbnailUrl ?? undefined}
          src={resolved.mediaUrl}
        />
      ) : resolved.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved.thumbnailUrl}
          alt={resolved.title ?? "视频"}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector 控件
// ---------------------------------------------------------------------------

export function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-[#1f2328]">{title}</p>
      {children}
    </div>
  );
}

export function InspectorRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-[#656d76]">
      <span className="shrink-0">{label}</span>
      {children}
    </label>
  );
}

export function InspectorSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      className="min-w-0 flex-1 rounded-md border border-[#d0d7de] bg-white px-2 py-1 text-xs text-[#1f2328]"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function InspectorToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-[#0969da]"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function InspectorNumber({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      className="min-w-0 flex-1 accent-[#0969da]"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function InspectorText({
  value,
  placeholder,
  maxLength = 120,
  onChange,
}: {
  value: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      className="min-w-0 flex-1 rounded-md border border-[#d0d7de] bg-white px-2 py-1 text-xs text-[#1f2328]"
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function InspectorTextarea({
  value,
  placeholder,
  maxLength = 2000,
  rows = 5,
  onChange,
}: {
  value: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      className="w-full rounded-md border border-[#d0d7de] bg-white px-2 py-1.5 text-xs leading-relaxed text-[#1f2328]"
      rows={rows}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** 大部分挂件没有可调项时的统一占位 */
export function InspectorEmpty({ hint }: { hint: string }) {
  return <p className="text-xs leading-relaxed text-[#8c959f]">{hint}</p>;
}
