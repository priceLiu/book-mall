import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import {
  gatewayV1ClientMeta,
  gatewayV1CreateTask,
  gatewayV1Image2ImageAsync,
  gatewayV1QwenImageEdit,
} from "@/lib/gateway/gateway-v1-http-client";
import { gatewayV1ClientMetaForBookUser } from "@/lib/gateway/gateway-log-meta-for-user";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import type { LocalEditClientApp } from "./types";

function clientSource(app: LocalEditClientApp): "CANVAS" | "E_COMMERCE" {
  return app === "canvas" ? "CANVAS" : "E_COMMERCE";
}

async function requireLocalEditGatewayAuth(userId: string) {
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在 Book 个人中心关联 Gateway API Key");
  }
  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError("Gateway API Key 未绑定厂商凭证");
  }
  return auth;
}

function buildMeta(
  clientApp: LocalEditClientApp,
  userId: string,
  clientPage?: string,
) {
  const source = clientSource(clientApp);
  if (source === "CANVAS") {
    return gatewayV1ClientMetaForBookUser("CANVAS", userId, { clientPage });
  }
  return gatewayV1ClientMeta("E_COMMERCE", { clientPage, bookUserId: userId });
}

export async function invokeQwenLocalEdit(opts: {
  userId: string;
  clientApp: LocalEditClientApp;
  modelKey: string;
  content: Array<{ image?: string; text?: string }>;
  parameters?: Record<string, unknown>;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string }> {
  const auth = await requireLocalEditGatewayAuth(opts.userId);
  const model = opts.modelKey.trim();
  routeGatewayModel(model);
  if (!pickCredentialForKind(auth.credentials, "BAILIAN")) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼 / DashScope 凭证");
  }
  return gatewayV1QwenImageEdit({
    apiKeyId: auth.id,
    body: { model, content: opts.content, parameters: opts.parameters },
    meta: await buildMeta(opts.clientApp, opts.userId, opts.clientPage),
  });
}

export async function invokeWanxPaintingLocalEdit(opts: {
  userId: string;
  clientApp: LocalEditClientApp;
  modelKey: string;
  input: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string }> {
  const auth = await requireLocalEditGatewayAuth(opts.userId);
  const model = opts.modelKey.trim();
  routeGatewayModel(model);
  if (!pickCredentialForKind(auth.credentials, "BAILIAN")) {
    throw new GatewayRequiredError("Gateway Key 未绑定百炼 / DashScope 凭证");
  }
  return gatewayV1Image2ImageAsync({
    apiKeyId: auth.id,
    body: { model, input: opts.input, parameters: opts.parameters },
    meta: await buildMeta(opts.clientApp, opts.userId, opts.clientPage),
  });
}

export async function invokeWan27LocalEdit(opts: {
  userId: string;
  clientApp: LocalEditClientApp;
  modelKey: string;
  content: Array<{ text: string } | { image: string }>;
  size?: string;
  n?: number;
  bboxList?: number[][][];
  clientPage?: string;
}): Promise<{ taskId: string; logId: string }> {
  const auth = await requireLocalEditGatewayAuth(opts.userId);
  const model = opts.modelKey.trim();
  routeGatewayModel(model);
  if (!pickCredentialForKind(auth.credentials, "DASHSCOPE")) {
    throw new GatewayRequiredError("Gateway Key 未绑定 DashScope 凭证");
  }
  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model,
      dashscope: {
        jobKind: "wan27-image" as const,
        content: opts.content,
        size: opts.size,
        n: opts.n,
        contentOrder: "images-first" as const,
        bboxList: opts.bboxList,
      },
    },
    meta: await buildMeta(opts.clientApp, opts.userId, opts.clientPage),
  });
  return { taskId: created.taskId, logId: created.logId };
}
