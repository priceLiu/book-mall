/**
 * 我的 AI 空间 · 「继续创作」深链
 *
 * Book 不内嵌子应用编辑器；点击后经 Book 侧 SSO 中转页 re-enter 到子站路由。
 * 公开分享页 **不得** 渲染这些链接（深链只对资产所有者有意义）。
 */

import type { WorkflowLaunchSpec } from "./ai-space-pin-types";

/** launch.app → Book 侧 SSO 中转页 */
const OPEN_ROUTE: Record<string, string> = {
  ecom: "/ecom-open",
  tools: "/tools-open",
  canvas: "/canvas-open",
  story: "/story-open",
  "quick-replica": "/quick-replica-open",
};

export function launchHref(launch: WorkflowLaunchSpec): string | null {
  const route = OPEN_ROUTE[launch.app];
  if (!route) return null;
  const path = launch.query
    ? `${launch.path}?${new URLSearchParams(launch.query).toString()}`
    : launch.path;
  return `${route}?path=${encodeURIComponent(path)}`;
}
