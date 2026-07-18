import type { GatewayProviderKind } from "@prisma/client";
import type { CanvasProviderKind } from "@prisma/client";

import { getGatewayForKind } from "@/lib/canvas/providers";
import type { CanvasProviderConfig } from "@/lib/canvas/providers/types";
import { decryptApiKey } from "@/lib/canvas/secret";
import {
  defaultBaseUrl,
  resolveDeepSeekBaseUrl,
  resolveKieApiRoot,
  resolveMoonshotBaseUrl,
  resolveOpenAiCompatibleBaseUrl,
} from "@/lib/gateway/model-router";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";

function toCanvasKind(kind: GatewayProviderKind): CanvasProviderKind {
  switch (kind) {
    case "KIE":
      return "KIE";
    case "BAILIAN":
      return "ALI_BAILIAN";
    case "DEEPSEEK":
    case "DASHSCOPE":
    case "VOLCENGINE":
    case "MOONSHOT":
      return "OPENAI_COMPAT";
    case "HUNYUAN":
      return "HUNYUAN_3D";
    default:
      return "OPENAI_COMPAT";
  }
}

function buildTestConfig(row: {
  id: string;
  alias: string;
  providerKind: GatewayProviderKind;
  apiKeyEncrypted: string;
  baseUrl: string | null;
}): CanvasProviderConfig {
  const base =
    row.providerKind === "BAILIAN" || row.providerKind === "DASHSCOPE"
      ? resolveOpenAiCompatibleBaseUrl(row.providerKind, row.baseUrl)
      : row.providerKind === "DEEPSEEK"
        ? resolveDeepSeekBaseUrl(row.baseUrl)
        : row.providerKind === "MOONSHOT"
          ? resolveMoonshotBaseUrl(row.baseUrl)
          : row.providerKind === "VOLCENGINE"
          ? (row.baseUrl?.trim() || defaultBaseUrl("VOLCENGINE")).replace(
              /\/$/,
              "",
            )
          : row.providerKind === "KIE"
            ? resolveKieApiRoot(row.baseUrl)
            : (row.baseUrl?.trim() || defaultBaseUrl(row.providerKind)).replace(
            /\/$/,
            "",
          );
  return {
    id: row.id,
    alias: row.alias,
    kind: toCanvasKind(row.providerKind),
    apiKey:
      row.providerKind === "VOLCENGINE"
        ? resolveVolcengineArkApiKey(decryptApiKey(row.apiKeyEncrypted))
        : decryptApiKey(row.apiKeyEncrypted),
    baseUrl: base,
  };
}

export async function testGatewayCredentialConnection(row: {
  id: string;
  alias: string;
  providerKind: GatewayProviderKind;
  apiKeyEncrypted: string;
  baseUrl: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    if (row.providerKind === "ELEVENLABS") {
      const apiKey = decryptApiKey(row.apiKeyEncrypted);
      const base = (row.baseUrl?.trim() || defaultBaseUrl("ELEVENLABS")).replace(/\/$/, "");
      const r = await fetch(`${base}/v1/user`, {
        headers: { "xi-api-key": apiKey },
        cache: "no-store",
      });
      if (r.ok) return { ok: true };
      const text = await r.text().catch(() => "");
      return { ok: false, message: text.slice(0, 200) || `HTTP ${r.status}` };
    }

    const config = buildTestConfig(row);
    const gateway = getGatewayForKind(config.kind, config);
    return await gateway.testConnection();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
