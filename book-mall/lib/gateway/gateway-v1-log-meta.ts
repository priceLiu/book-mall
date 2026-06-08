import type { GatewayClientSource } from "@prisma/client";

export type GatewayV1LogMeta = {
  clientSource?: GatewayClientSource;
  clientPage?: string | null;
  storyProjectId?: string | null;
  storyTaskId?: string | null;
};

export function gatewayV1MetaHeaders(
  meta?: GatewayV1LogMeta,
): Record<string, string> {
  if (!meta) return {};
  const h: Record<string, string> = {};
  if (meta.clientSource) h["x-gateway-client"] = meta.clientSource;
  if (meta.clientPage) h["x-gateway-client-page"] = meta.clientPage;
  if (meta.storyProjectId) h["x-gateway-story-project-id"] = meta.storyProjectId;
  if (meta.storyTaskId) h["x-gateway-story-task-id"] = meta.storyTaskId;
  return h;
}

export function parseGatewayV1LogMeta(request: Request): GatewayV1LogMeta {
  return {
    clientSource: parseClientSourceHeader(request.headers.get("x-gateway-client")),
    clientPage: request.headers.get("x-gateway-client-page"),
    storyProjectId: request.headers.get("x-gateway-story-project-id"),
    storyTaskId: request.headers.get("x-gateway-story-task-id"),
  };
}

function parseClientSourceHeader(
  header: string | null,
): GatewayClientSource | undefined {
  const v = header?.toUpperCase();
  if (v === "STORY") return "STORY";
  if (v === "CANVAS") return "CANVAS";
  if (v === "TOOL") return "TOOL";
  if (v === "E_COMMERCE") return "E_COMMERCE";
  if (v === "GATEWAY_CONSOLE") return "GATEWAY_CONSOLE";
  if (v === "EXTERNAL") return "EXTERNAL";
  return undefined;
}
