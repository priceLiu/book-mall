/**
 * Gateway · 火山方舟（VOLCENGINE）凭证选用
 *
 * 分镜视频 1.0 / 影视专业版 2.0 Seedance 生视频须经 Gateway（sk-gw），禁止业务层直连 ARK。
 * 平台默认 Key 来源：`VOLCENGINE_API_KEY` → 凭证别名「火山方舟」。
 */

import type { RoutableCredential } from "@/lib/gateway/gateway-credential-match";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";

/** 平台默认 · 与 platform-credential-seed 一致 */
export const PLATFORM_VOLCENGINE_CREDENTIAL_ALIAS = "火山方舟";

/** 分镜视频 1.0 专用 · 与 setup-sbv1-volcengine-gateway.ts 一致（Key 值同 VOLCENGINE_API_KEY） */
export const SBV1_VOLCENGINE_CREDENTIAL_ALIAS = "火山方舟 · 分镜视频1.0";

export const GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID = "gateway:sbv1-volcengine";

export function isSbv1GatewayContext(opts: {
  clientPage?: string | null;
  input?: Record<string, unknown> | null;
  providerId?: string | null;
}): boolean {
  const page = opts.clientPage?.trim() ?? "";
  if (page.includes("/sbv1")) return true;
  if (opts.input?.sbv1Billing != null && typeof opts.input.sbv1Billing === "object") {
    return true;
  }
  const pid = opts.providerId?.trim() ?? "";
  if (pid === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID) return true;
  return false;
}

function findVolcengineCredentialByAlias(
  credentials: RoutableCredential[],
  alias: string,
): string | null {
  const match = credentials.find(
    (c) =>
      c.providerKind === "VOLCENGINE" && c.alias?.trim() === alias.trim(),
  );
  return match?.id ?? null;
}

function readGatewayCredentialIdFromInput(
  input?: Record<string, unknown> | null,
): string | null {
  const raw = input?.gatewayCredentialId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readProviderIdFromInput(
  input?: Record<string, unknown> | null,
): string | null {
  const raw = input?.providerId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Gateway createTask / Canvas·Story 火山视频任务选用凭证。
 *
 * - **分镜视频 1.0**：优先「火山方舟 · 分镜视频1.0」，否则「火山方舟」，再兜底绑定列表。
 * - **影视专业版 2.0 / Story / 电商等**：默认「火山方舟」；`gatewayCredentialId` 可选覆盖（生视频 BYOK）。
 */
export function pickVolcengineCredentialForGatewayJob(opts: {
  credentials: RoutableCredential[];
  modelKey: string;
  clientPage?: string | null;
  input?: Record<string, unknown> | null;
  preferredCredentialId?: string | null;
  providerId?: string | null;
}): string | null {
  const providerId =
    opts.providerId?.trim() || readProviderIdFromInput(opts.input) || null;
  const preferred =
    opts.preferredCredentialId?.trim() ||
    readGatewayCredentialIdFromInput(opts.input) ||
    null;

  const sbv1 = isSbv1GatewayContext({
    clientPage: opts.clientPage,
    input: opts.input,
    providerId,
  });

  if (sbv1) {
    return (
      findVolcengineCredentialByAlias(
        opts.credentials,
        SBV1_VOLCENGINE_CREDENTIAL_ALIAS,
      ) ??
      findVolcengineCredentialByAlias(
        opts.credentials,
        PLATFORM_VOLCENGINE_CREDENTIAL_ALIAS,
      ) ??
      pickCredentialForKind(opts.credentials, "VOLCENGINE")
    );
  }

  if (preferred) {
    const explicit = pickCredentialForKind(
      opts.credentials,
      "VOLCENGINE",
      preferred,
    );
    if (explicit) return explicit;
  }

  return (
    findVolcengineCredentialByAlias(
      opts.credentials,
      PLATFORM_VOLCENGINE_CREDENTIAL_ALIAS,
    ) ?? pickCredentialForKind(opts.credentials, "VOLCENGINE")
  );
}

/** 分镜视频 1.0 · 真人人像 H5 等账号级能力 */
export function pickSbv1VolcengineCredentialId(
  credentials: RoutableCredential[],
): string | null {
  return pickVolcengineCredentialForGatewayJob({
    credentials,
    modelKey: "doubao-seedance-2.0",
    clientPage: "sbv1/portrait",
    input: { sbv1Billing: { edition: "sbv1" } },
  });
}
