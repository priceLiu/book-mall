import type { GatewayClientSource, BillingPersona } from "@prisma/client";

export type GatewayV1LogMeta = {
  clientSource?: GatewayClientSource;
  clientPage?: string | null;
  storyProjectId?: string | null;
  storyTaskId?: string | null;
  tenantId?: string | null;
  actorBookUserId?: string | null;
  seatId?: string | null;
  staffFlag?: boolean;
  billingPersonaSnap?: BillingPersona | null;
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
  if (meta.tenantId) h["x-gateway-tenant-id"] = meta.tenantId;
  if (meta.actorBookUserId) h["x-gateway-actor"] = meta.actorBookUserId;
  if (meta.seatId) h["x-gateway-seat-id"] = meta.seatId;
  if (meta.staffFlag) h["x-gateway-staff-flag"] = "1";
  if (meta.billingPersonaSnap) h["x-gateway-persona"] = meta.billingPersonaSnap;
  return h;
}

export function parseGatewayV1LogMeta(request: Request): GatewayV1LogMeta {
  return {
    clientSource: parseClientSourceHeader(request.headers.get("x-gateway-client")),
    clientPage: request.headers.get("x-gateway-client-page"),
    storyProjectId: request.headers.get("x-gateway-story-project-id"),
    storyTaskId: request.headers.get("x-gateway-story-task-id"),
    tenantId: request.headers.get("x-gateway-tenant-id"),
    actorBookUserId: request.headers.get("x-gateway-actor"),
    seatId: request.headers.get("x-gateway-seat-id"),
    staffFlag: request.headers.get("x-gateway-staff-flag") === "1",
    billingPersonaSnap: parsePersonaHeader(request.headers.get("x-gateway-persona")),
  };
}

export function logMetaToRequestLogFields(meta: GatewayV1LogMeta) {
  return {
    clientPage: meta.clientPage ?? undefined,
    storyProjectId: meta.storyProjectId ?? undefined,
    storyTaskId: meta.storyTaskId ?? undefined,
    tenantId: meta.tenantId ?? undefined,
    actorBookUserId: meta.actorBookUserId ?? undefined,
    seatId: meta.seatId ?? undefined,
    staffFlag: meta.staffFlag,
    billingPersonaSnap: meta.billingPersonaSnap ?? undefined,
  };
}

function parsePersonaHeader(header: string | null): BillingPersona | undefined {
  if (header === "PLATFORM_CREDIT" || header === "BYOK") return header;
  return undefined;
}

function parseClientSourceHeader(
  header: string | null,
): GatewayClientSource | undefined {
  const v = header?.toUpperCase();
  if (v === "STORY") return "STORY";
  if (v === "CANVAS") return "CANVAS";
  if (v === "TOOL") return "TOOL";
  if (v === "E_COMMERCE") return "E_COMMERCE";
  if (v === "QUICK_REPLICA") return "QUICK_REPLICA";
  if (v === "GATEWAY_CONSOLE") return "GATEWAY_CONSOLE";
  if (v === "EXTERNAL") return "EXTERNAL";
  return undefined;
}
