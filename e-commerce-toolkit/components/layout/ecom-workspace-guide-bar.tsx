"use client";

import { usePathname } from "next/navigation";

import { EcomFeishuGuideLink } from "@/components/layout/ecom-feishu-guide-link";
import {
  feishuGuideUrlForModuleId,
  feishuGuideUrlForPathname,
} from "@/lib/ecom-feishu-guide-urls";
import { cn } from "@/lib/utils";

function resolveFeishuGuideUrl(pathname: string, moduleId?: string): string | undefined {
  if (moduleId) return feishuGuideUrlForModuleId(moduleId);
  return feishuGuideUrlForPathname(pathname);
}

function shouldShowFeishuGuide(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/library")) return false;
  return true;
}

type GuideChipProps = {
  moduleId?: string;
  className?: string;
};

/** 顶栏「使用指南」chip（与图标工具条同一行） */
export function EcomFeishuGuideToolbarChip({ moduleId, className }: GuideChipProps) {
  const pathname = usePathname() ?? "";
  if (!shouldShowFeishuGuide(pathname)) return null;
  const guideUrl = resolveFeishuGuideUrl(pathname, moduleId);
  if (!guideUrl) return null;
  return (
    <EcomFeishuGuideLink href={guideUrl} variant="chip" className={cn("shrink-0", className)} />
  );
}

/** @deprecated 全局单独一行顶栏已移除；请用 EcomIconToolbar 或 EcomFeishuGuideToolbarChip */
export function EcomWorkspaceGuideBar() {
  return null;
}
