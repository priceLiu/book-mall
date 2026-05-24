/**
 * canvas v2 · Provider Gateway 工厂
 *
 * 用法：
 *   import { getGatewayFor } from "@/lib/canvas/providers";
 *   const gateway = getGatewayFor(provider);
 *   await gateway.chat({...});
 */

import type { CanvasProvider, CanvasProviderKind } from "@prisma/client";

import { decryptApiKey } from "../secret";

import { AliBailianGateway } from "./ali-bailian";
import { Hunyuan3DGateway } from "./hunyuan-3d";
import { KieGateway } from "./kie";
import { OpenAiCompatGateway } from "./openai-compat";
import {
  CanvasGatewayError,
  type CanvasProviderConfig,
  type CanvasProviderGateway,
} from "./types";

export * from "./types";

export function buildGatewayConfig(
  provider: CanvasProvider,
): CanvasProviderConfig {
  return {
    id: provider.id,
    alias: provider.alias,
    kind: provider.kind,
    apiKey: decryptApiKey(provider.apiKeyEncrypted),
    baseUrl: provider.baseUrl,
  };
}

export function getGatewayFor(provider: CanvasProvider): CanvasProviderGateway {
  return getGatewayForKind(provider.kind, buildGatewayConfig(provider));
}

export function getGatewayForKind(
  kind: CanvasProviderKind,
  config: CanvasProviderConfig,
): CanvasProviderGateway {
  switch (kind) {
    case "KIE":
      return new KieGateway(config);
    case "ALI_BAILIAN":
      return new AliBailianGateway(config);
    case "OPENAI_COMPAT":
      return new OpenAiCompatGateway(config, {
        kind: "OPENAI_COMPAT",
      });
    case "HUNYUAN_3D":
      return new Hunyuan3DGateway(config);
    case "GEMINI_NATIVE":
      throw new CanvasGatewayError(
        "PROVIDER_UNSUPPORTED",
        "GEMINI_NATIVE 暂未实现，请改用 OPENAI_COMPAT 接入第三方网关。",
        501,
        false,
      );
    default:
      throw new CanvasGatewayError(
        "PROVIDER_UNSUPPORTED",
        `Provider kind ${kind} 不支持`,
        501,
        false,
      );
  }
}
