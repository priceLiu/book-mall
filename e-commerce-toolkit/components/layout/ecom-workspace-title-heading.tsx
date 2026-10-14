"use client";

import { EcomFeishuGuideLink } from "@/components/layout/ecom-feishu-guide-link";
import { EcomFeishuGuideToolbarChip } from "@/components/layout/ecom-workspace-guide-bar";
import { cn } from "@/lib/utils";

type Props = {
  title: React.ReactNode;
  /** 副标题等，放在标题行下方 */
  children?: React.ReactNode;
  /** 标题上方小字（如「我的工作流」） */
  eyebrow?: React.ReactNode;
  guideModuleId?: string;
  /** 首页等无 module 映射时直接指定飞书链接 */
  guideHref?: string;
  heading?: "h1" | "h2";
  titleClassName?: string;
  className?: string;
};

/** 工作区顶栏标题 + 标题右侧「使用指南」 */
export function EcomWorkspaceTitleHeading({
  title,
  children,
  eyebrow,
  guideModuleId,
  guideHref,
  heading = "h2",
  titleClassName,
  className,
}: Props) {
  const H = heading;
  return (
    <div className={cn("min-w-0", className)}>
      {eyebrow ? (
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">
          {eyebrow}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <H className={cn("text-sm font-semibold text-[#1d1d1f]", titleClassName)}>
          {title}
        </H>
        {guideHref ? (
          <EcomFeishuGuideLink href={guideHref} variant="chip" className="shrink-0" />
        ) : (
          <EcomFeishuGuideToolbarChip moduleId={guideModuleId} />
        )}
      </div>
      {children}
    </div>
  );
}
