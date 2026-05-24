/**
 * canvas v2 · 系统级 Provider（共享 KIE Key）
 *
 * 让用户无需自己配置 KIE，可直接使用站点 `.env` 中的 `KIE_API_KEY`。
 *
 * 约束：
 *  - 不进 DB（id 不是合法 cuid，CanvasGenerationTask.providerId FK 会失败）；
 *    所以 task 落库时 `providerId` 写 `null`，但 `inputHash / inputPayload.providerId`
 *    仍记录系统 id 以正确做缓存命中区分。
 *  - 仅当 `KIE_API_KEY` 已配置时才启用；前端在 EnginePicker 里按 alias 区分。
 */

import type { CanvasProviderKind } from "@prisma/client";

import { DEEPSEEK_KNOWN_MODELS, DEEPSEEK_SYSTEM_BASE_URL } from "./providers/deepseek-system";
import { KIE_KNOWN_MODELS } from "./providers/kie";
import { listHunyuanKnownModels } from "./providers/hunyuan-3d";
import {
  getDefaultProviderBaseUrl,
  type CanvasProviderConfig,
} from "./providers/types";
import type { CanvasProviderDto } from "./canvas-provider-service";

export const SYSTEM_PROVIDER_PREFIX = "system:";
export const SYSTEM_KIE_PROVIDER_ID = "system:kie";
export const SYSTEM_DEEPSEEK_PROVIDER_ID = "system:deepseek";
export const SYSTEM_HUNYUAN_3D_PROVIDER_ID = "system:hunyuan-3d";

export function isDeepSeekSystemEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY?.trim();
}

export function isSystemProviderId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(SYSTEM_PROVIDER_PREFIX);
}

export function isKieSystemEnabled(): boolean {
  return !!process.env.KIE_API_KEY?.trim();
}

export function isHunyuan3DSystemEnabled(): boolean {
  return !!(
    process.env.HUNYUAN_3D_API_KEY?.trim() ||
    process.env.HUNYUAN_TOKENHUB_API_KEY?.trim() ||
    (process.env.HUNYUAN_TC_SECRET_ID?.trim() &&
      process.env.HUNYUAN_TC_SECRET_KEY?.trim())
  );
}

/** 列出所有启用的系统 Provider DTO（用于 GET /providers 列表前置）。 */
export function listSystemProviderDtos(): CanvasProviderDto[] {
  const out: CanvasProviderDto[] = [];
  if (isDeepSeekSystemEnabled()) {
    out.push({
      id: SYSTEM_DEEPSEEK_PROVIDER_ID,
      alias: "系统 · DeepSeek（共享 key）",
      kind: "OPENAI_COMPAT",
      baseUrl: DEEPSEEK_SYSTEM_BASE_URL,
      apiKeyMasked: "system",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "system",
      models: DEEPSEEK_KNOWN_MODELS.map((m, idx) => ({
        id: `${SYSTEM_DEEPSEEK_PROVIDER_ID}::${m.modelKey}`,
        modelKey: m.modelKey,
        displayName: m.displayName,
        role: m.role,
        description: m.description ?? null,
        paramsSchema: m.paramsSchema ?? null,
        defaultParams:
          (m.defaultParams as Record<string, unknown> | undefined) ?? null,
        enabled: true,
        sortOrder: idx,
      })),
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });
  }
  if (isKieSystemEnabled()) {
    out.push({
      id: SYSTEM_KIE_PROVIDER_ID,
      alias: "系统 · KIE（共享 key）",
      kind: "KIE",
      baseUrl: getDefaultProviderBaseUrl("KIE"),
      apiKeyMasked: "system",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "system",
      models: KIE_KNOWN_MODELS.map((m, idx) => ({
        id: `${SYSTEM_KIE_PROVIDER_ID}::${m.modelKey}`,
        modelKey: m.modelKey,
        displayName: m.displayName,
        role: m.role,
        description: m.description ?? null,
        paramsSchema: m.paramsSchema ?? null,
        defaultParams:
          (m.defaultParams as Record<string, unknown> | undefined) ?? null,
        enabled: true,
        sortOrder: idx,
      })),
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });
  }
  if (isHunyuan3DSystemEnabled()) {
    out.push({
      id: SYSTEM_HUNYUAN_3D_PROVIDER_ID,
      alias: "系统 · 腾讯混元生3D",
      kind: "HUNYUAN_3D",
      baseUrl: getDefaultProviderBaseUrl("HUNYUAN_3D"),
      apiKeyMasked: "system",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "system",
      models: listHunyuanKnownModels().map((m, idx) => ({
        id: `${SYSTEM_HUNYUAN_3D_PROVIDER_ID}::${m.modelKey}`,
        modelKey: m.modelKey,
        displayName: m.displayName,
        role: m.role,
        description: m.description ?? null,
        paramsSchema: m.paramsSchema ?? null,
        defaultParams:
          (m.defaultParams as Record<string, unknown> | undefined) ?? null,
        enabled: true,
        sortOrder: idx,
      })),
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });
  }
  return out;
}

export type ResolvedSystemProvider = {
  kind: CanvasProviderKind;
  config: CanvasProviderConfig;
};

/** 给定系统 providerId，返回可用 gateway config；未启用 / 不识别返回 null。 */
export function resolveSystemProvider(
  providerId: string,
): ResolvedSystemProvider | null {
  if (providerId === SYSTEM_DEEPSEEK_PROVIDER_ID) {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      kind: "OPENAI_COMPAT",
      config: {
        id: SYSTEM_DEEPSEEK_PROVIDER_ID,
        alias: "系统 · DeepSeek",
        kind: "OPENAI_COMPAT",
        apiKey,
        baseUrl: DEEPSEEK_SYSTEM_BASE_URL,
      },
    };
  }
  if (providerId === SYSTEM_KIE_PROVIDER_ID) {
    const apiKey = process.env.KIE_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      kind: "KIE",
      config: {
        id: SYSTEM_KIE_PROVIDER_ID,
        alias: "系统 · KIE",
        kind: "KIE",
        apiKey,
        baseUrl: getDefaultProviderBaseUrl("KIE"),
      },
    };
  }
  if (providerId === SYSTEM_HUNYUAN_3D_PROVIDER_ID) {
    const proKey = process.env.HUNYUAN_3D_API_KEY?.trim();
    const tokenHubKey = process.env.HUNYUAN_TOKENHUB_API_KEY?.trim();
    const tcId = process.env.HUNYUAN_TC_SECRET_ID?.trim();
    const tcKey = process.env.HUNYUAN_TC_SECRET_KEY?.trim();
    const apiKey =
      proKey ||
      tokenHubKey ||
      (tcId && tcKey
        ? JSON.stringify({
            t: "tc3",
            id: tcId,
            key: tcKey,
            region: process.env.HUNYUAN_TC_REGION?.trim() || "ap-guangzhou",
          })
        : "");
    if (!apiKey) return null;
    return {
      kind: "HUNYUAN_3D",
      config: {
        id: SYSTEM_HUNYUAN_3D_PROVIDER_ID,
        alias: "系统 · 腾讯混元生3D",
        kind: "HUNYUAN_3D",
        apiKey,
        baseUrl: getDefaultProviderBaseUrl("HUNYUAN_3D"),
      },
    };
  }
  return null;
}
