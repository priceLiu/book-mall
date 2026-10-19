import type { GatewayClientSource, GatewayRequestKind } from "@prisma/client";

import { classifyGatewayRequestKind } from "@/lib/admin/platform-cockpit-model-usage";

export type CockpitDailyAppKey =
  | "canvas"
  | "ecom"
  | "story"
  | "tool"
  | "quick-replica"
  | "gateway-console"
  | "other";

const APP_LABELS: Record<CockpitDailyAppKey, string> = {
  canvas: "Canvas 画布",
  ecom: "电商工具箱",
  story: "Story",
  tool: "工具站",
  "quick-replica": "QuickReplica",
  "gateway-console": "Gateway 控制台",
  other: "其他",
};

export function cockpitDailyAppLabel(appKey: CockpitDailyAppKey): string {
  return APP_LABELS[appKey] ?? appKey;
}

export function resolveCockpitDailyAppKey(input: {
  clientSource: GatewayClientSource | null | undefined;
  clientPage: string | null | undefined;
}): CockpitDailyAppKey {
  const page = input.clientPage?.trim() ?? "";
  const src = input.clientSource;
  if (page.startsWith("canvas/") || src === "CANVAS") return "canvas";
  if (page.startsWith("ecom/") || src === "E_COMMERCE") return "ecom";
  if (page.startsWith("story/") || src === "STORY") return "story";
  if (src === "TOOL") return "tool";
  if (src === "QUICK_REPLICA") return "quick-replica";
  if (src === "GATEWAY_CONSOLE") return "gateway-console";
  return "other";
}

/** 从 clientPage / storyProjectId 提取可钻取的项目键（非 UUID 时仍保留原串） */
export function resolveCockpitDailyProjectKey(input: {
  clientPage: string | null | undefined;
  storyProjectId: string | null | undefined;
  appKey: CockpitDailyAppKey;
}): string {
  const page = input.clientPage?.trim() ?? "";
  if (input.appKey === "canvas") {
    const m = page.match(/^canvas\/([^/]+)/);
    if (m?.[1]) return m[1];
  }
  if (input.appKey === "ecom") {
    const parts = page.split("/");
    if (parts.length >= 3 && parts[0] === "ecom") return parts[2]!;
  }
  if (input.storyProjectId?.trim()) return input.storyProjectId.trim();
  if (page) return page.length > 48 ? `${page.slice(0, 45)}…` : page;
  return "—";
}

export function resolveCockpitDailyMediaKind(
  requestKind: GatewayRequestKind | string,
): "image" | "video" | "other" {
  return classifyGatewayRequestKind(String(requestKind));
}
