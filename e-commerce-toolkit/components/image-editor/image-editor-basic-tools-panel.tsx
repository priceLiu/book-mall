"use client";

import Link from "next/link";
import {
  CircleDashed,
  Expand,
  Languages,
  Layers,
  Pencil,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ToolAction = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
};

type Props = {
  disabled?: boolean;
  onCutout: () => void;
  onEnhance: () => void;
  onInpaint: () => void;
  onAiFlower: () => void;
};

const IMAGE_TOOLS: Array<Omit<ToolAction, "onClick"> & { action: "cutout" | "enhance" | "inpaint" | "link" }> = [
  {
    id: "smart-cutout",
    title: "智能抠图",
    description: "秒级抠图，快速去除复杂背景",
    icon: CircleDashed,
    action: "cutout",
  },
  {
    id: "enhance",
    title: "变清晰",
    description: "超清画质重生，告别渣画质",
    icon: Sparkles,
    action: "enhance",
  },
  {
    id: "layer",
    title: "图片分层",
    description: "智能识别图像元素，快速完成抠图分层",
    icon: Layers,
    action: "link",
    href: "/ecom/image-layer",
  },
  {
    id: "translate",
    title: "图片翻译",
    description: "图片文字翻译多国语言，助力跨境营销",
    icon: Languages,
    action: "link",
    href: "/ecom/image-processing",
  },
  {
    id: "outpaint",
    title: "AI扩图",
    description: "根据原图进行画面扩展，支持多种尺寸",
    icon: Expand,
    action: "link",
    href: "/ecom/image-processing",
  },
  {
    id: "generate",
    title: "AI生图",
    description: "输入文字或参考图，AI生成描述的新素材",
    icon: Wand2,
    action: "link",
    href: "/ecom/image-processing",
  },
  {
    id: "inpaint",
    title: "局部重绘",
    description: "输入文字，AI重绘指定区域",
    icon: Pencil,
    badge: "Beta",
    action: "inpaint",
  },
];

const TEXT_TOOLS: ToolAction[] = [
  {
    id: "ai-flower",
    title: "AI花字",
    description: "更多创意文字效果，非常适合海报标题",
    icon: Type,
  },
];

export function ImageEditorBasicToolsPanel({ disabled, onCutout, onEnhance, onInpaint, onAiFlower }: Props) {
  const blockLinks = disabled;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm">
      <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <ToolSection title="图片工具">
          {IMAGE_TOOLS.map((item) => (
            <BasicToolRow
              key={item.id}
              title={item.title}
              description={item.description}
              icon={item.icon}
              badge={item.badge}
              disabled={
                item.action === "link"
                  ? blockLinks
                  : disabled &&
                    item.action !== "cutout" &&
                    item.action !== "enhance" &&
                    item.action !== "inpaint"
              }
              href={item.action === "link" ? item.href : undefined}
              onClick={
                item.action === "cutout"
                  ? onCutout
                  : item.action === "enhance"
                    ? onEnhance
                    : item.action === "inpaint"
                      ? onInpaint
                      : undefined
              }
            />
          ))}
        </ToolSection>
        <ToolSection title="文字工具">
          {TEXT_TOOLS.map((item) => (
            <BasicToolRow
              key={item.id}
              title={item.title}
              description={item.description}
              icon={item.icon}
              badge={item.badge}
              disabled={disabled}
              onClick={onAiFlower}
            />
          ))}
        </ToolSection>
      </div>
    </div>
  );
}

function ToolSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[13px] font-semibold text-[var(--ie-ink)]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function BasicToolRow({
  title,
  description,
  icon: Icon,
  badge,
  disabled,
  href,
  onClick,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--ie-border-soft)] bg-white text-[var(--ie-ink)]">
        <Icon className="h-[18px] w-[18px] stroke-[1.5]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-[var(--ie-ink)]">{title}</span>
          {badge ? (
            <span className="rounded bg-[var(--ie-cream-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ie-muted)]">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[var(--ie-muted)]">{description}</span>
      </span>
    </>
  );

  const className = cn(
    "flex w-full items-start gap-2.5 rounded-xl border border-transparent bg-[var(--ie-cream-muted)] px-2.5 py-2.5 text-left transition-colors",
    disabled ? "cursor-not-allowed opacity-45" : "hover:border-[var(--ie-border-soft)] hover:bg-white",
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled || !onClick} className={className} onClick={onClick}>
      {inner}
    </button>
  );
}