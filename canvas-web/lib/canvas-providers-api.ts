/**
 * canvas v2 · Provider API 浏览器侧客户端
 */

import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type CanvasProviderKindLiteral =
  | "KIE"
  | "ALI_BAILIAN"
  | "OPENAI_COMPAT"
  | "GEMINI_NATIVE"
  | "HUNYUAN_3D";

export type CanvasParamSchemaItem =
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      defaultValue?: string;
      required?: boolean;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "text" | "textarea";
      defaultValue?: string;
      placeholder?: string;
      required?: boolean;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "number";
      min?: number;
      max?: number;
      step?: number;
      defaultValue?: number;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      defaultValue?: boolean;
      help?: string;
    };

export type CanvasParamSchema = CanvasParamSchemaItem[];

export type CanvasProviderModelDto = {
  id: string;
  modelKey: string;
  displayName: string;
  role: "IMAGE" | "VIDEO" | "LLM";
  description: string | null;
  paramsSchema: CanvasParamSchema | null;
  defaultParams: Record<string, unknown> | null;
  enabled: boolean;
  sortOrder: number;
};

export type CanvasProviderDto = {
  id: string;
  alias: string;
  kind: CanvasProviderKindLiteral;
  baseUrl: string | null;
  apiKeyMasked: string;
  active: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  models: CanvasProviderModelDto[];
  createdAt: string;
  updatedAt: string;
};

export type GatewayLinkStatusDto = {
  linked: boolean;
  gatewayApiKeyId: string | null;
  keyPrefix: string | null;
  keyName: string | null;
  linkedAt: string | null;
  boundKinds: Array<
    | "KIE"
    | "BAILIAN"
    | "DEEPSEEK"
    | "DASHSCOPE"
    | "HUNYUAN"
    | "VOLCENGINE"
    | "TOPAZ"
    | "MINIMAX"
    | "WORLDLABS"
    | "ELEVENLABS"
  >;
  revoked: boolean;
};

export type ListCanvasProvidersResult = {
  providers: CanvasProviderDto[];
  gatewayLink: GatewayLinkStatusDto;
};

async function call<T>(
  base: string,
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const { url, init: i } = resolveBookMallBrowserRequest(base, apiPath, init);
  const r = await fetch(url, i);
  // 一次性读 body：Response.body 是 ReadableStream，二次消费会抛
  // "body stream already read"。读完后再按需 JSON 解析。
  const raw = await r.text();
  if (!r.ok) {
    let msg = "";
    try {
      const j = JSON.parse(raw) as { error?: string; message?: string };
      msg = j.message ?? j.error ?? "";
    } catch {
      msg = raw;
    }
    throw new Error(`${r.status} ${msg || r.statusText}`);
  }
  if (!raw) return undefined as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Bad JSON from ${apiPath}: ${raw.slice(0, 200)}`);
  }
}

export async function listCanvasProviders(
  base: string,
): Promise<ListCanvasProvidersResult> {
  return call<ListCanvasProvidersResult>(base, "/api/canvas/providers");
}

export async function fetchGatewayLinkStatus(
  base: string,
): Promise<GatewayLinkStatusDto> {
  return call<GatewayLinkStatusDto>(base, "/api/canvas/gateway-link-status");
}

export async function createCanvasProvider(
  base: string,
  args: {
    alias: string;
    kind: CanvasProviderKindLiteral;
    apiKey: string;
    baseUrl?: string | null;
  },
): Promise<CanvasProviderDto> {
  const j = await call<{ provider: CanvasProviderDto }>(
    base,
    "/api/canvas/providers",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  return j.provider;
}

export async function patchCanvasProvider(
  base: string,
  id: string,
  patch: {
    alias?: string;
    apiKey?: string;
    baseUrl?: string | null;
    active?: boolean;
  },
): Promise<CanvasProviderDto> {
  const j = await call<{ provider: CanvasProviderDto }>(
    base,
    `/api/canvas/providers/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.provider;
}

export async function deleteCanvasProvider(
  base: string,
  id: string,
): Promise<void> {
  await call<{ ok: true }>(base, `/api/canvas/providers/${id}`, {
    method: "DELETE",
  });
}

export async function testCanvasProvider(
  base: string,
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  return call<{ ok: boolean; message?: string }>(
    base,
    `/api/canvas/providers/${id}/test`,
    { method: "POST" },
  );
}

export async function refreshCanvasProviderModels(
  base: string,
  id: string,
): Promise<CanvasProviderDto> {
  const j = await call<{ provider: CanvasProviderDto }>(
    base,
    `/api/canvas/providers/${id}/models/refresh`,
    { method: "POST" },
  );
  return j.provider;
}

export async function patchCanvasProviderModel(
  base: string,
  providerId: string,
  modelId: string,
  patch: { enabled?: boolean; sortOrder?: number; displayName?: string },
): Promise<CanvasProviderModelDto> {
  const j = await call<{ model: CanvasProviderModelDto }>(
    base,
    `/api/canvas/providers/${providerId}/models/${modelId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return j.model;
}
