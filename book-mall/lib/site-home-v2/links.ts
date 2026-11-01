import { buildBookPortalOpenPageHref } from "@/lib/platform-portal-entry";

/** V2 首页 · 五大场景与子站入口（相对 book-mall 同源 open 页） */
export function homeV2EcomHref(): string {
  return buildBookPortalOpenPageHref("e-commerce", "/") ?? "/ecom-open?path=%2F";
}

export function homeV2CanvasHref(path = "/projects"): string {
  return buildBookPortalOpenPageHref("canvas", path) ?? "/canvas-open?path=%2Fprojects";
}

export function homeV2ToolHref(path = "/"): string {
  return buildBookPortalOpenPageHref("tool", path) ?? `/tool-open?path=${encodeURIComponent(path)}`;
}

export function homeV2QuickReplicaHref(templateId?: string): string {
  const path = templateId
    ? `/?templateId=${encodeURIComponent(templateId)}`
    : "/";
  return (
    buildBookPortalOpenPageHref("quick-replica", path) ??
    `/quick-replica-open?path=${encodeURIComponent(path)}`
  );
}

export const HOME_V2_ANCHORS = {
  top: "#top",
  scenes: "#scenes",
  skills: "#skills",
  why: "#why",
  quickReplica: "#quick-replica-showcase",
  cta: "#cta",
  pricing: "/pricing",
  apiPricing: "/pricing/api",
} as const;
