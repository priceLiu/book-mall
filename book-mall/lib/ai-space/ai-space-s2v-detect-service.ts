/**
 * 我的 AI 空间 · 数字人形象图预检（wan2.2-s2v-detect）
 *
 * S2V 厂商侧排队常达数十分钟，形象图不合格时代价极高（长时间等待后才失败）。
 * 因此形象入库即同步预检一次，结果缓存在 `AiSpaceDigitalHuman.meta.detect`，
 * 合成前只在「未检测」或「换过图」时才重新调用厂商（0.004 元/张）。
 */

import { dashscopeDetectS2vImage } from "@/lib/gateway/dashscope-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { createRequestLog, finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";

import { requireAiSpaceDashscopeAuth, resolveAiSpaceS2vBaseUrl } from "./ai-space-gateway-auth";
import type { AiSpaceDigitalHumanDetect } from "./ai-space-digital-human-types";

const DETECT_MODEL_KEY = "wan2.2-s2v-detect";
const DETECT_ENDPOINT = "/api/v1/services/aigc/image2video/face-detect";

/** 检测不通过时给用户的可执行建议 */
export const S2V_DETECT_FAILED_HINT =
  "形象图未通过数字人检测：请换一张单人、正面、五官清晰无遮挡的人像（真人或卡通均可），避免多人、背影、大幅遮挡或过度模糊";

function readDetect(meta: unknown): AiSpaceDigitalHumanDetect | null {
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as { detect?: unknown }).detect;
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.checkPass !== "boolean") return null;
  return {
    checkPass: d.checkPass,
    humanoid: typeof d.humanoid === "boolean" ? d.humanoid : null,
    message: typeof d.message === "string" ? d.message : null,
    checkedAt: typeof d.checkedAt === "string" ? d.checkedAt : null,
    imageUrl: typeof d.imageUrl === "string" ? d.imageUrl : null,
  };
}

/** 读取已缓存的检测结果（换过图则视为未检测） */
export function readDigitalHumanDetect(
  meta: unknown,
  avatarImageUrl: string,
): AiSpaceDigitalHumanDetect | null {
  const detect = readDetect(meta);
  if (!detect) return null;
  if (detect.imageUrl && detect.imageUrl !== avatarImageUrl) return null;
  return detect;
}

/**
 * 调厂商检测一次并落库（写 `GatewayRequestLog`，计费 0.004 元/张）。
 * 检测不通过时形象状态置 `detect_failed`，通过则恢复 `active`。
 */
export async function detectAiSpaceDigitalHumanImage(args: {
  userId: string;
  digitalHumanId: string;
}): Promise<AiSpaceDigitalHumanDetect> {
  const row = await prisma.aiSpaceDigitalHuman.findFirst({
    where: { id: args.digitalHumanId, userId: args.userId },
    select: { id: true, avatarImageUrl: true, status: true, meta: true },
  });
  if (!row) throw new Error("数字人形象不存在");

  const { auth, credentialId } = await requireAiSpaceDashscopeAuth(args.userId);
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) throw new Error("Gateway 凭证不可用，请在模型管理页重新绑定");

  const payload = {
    model: DETECT_MODEL_KEY,
    input: { image_url: row.avatarImageUrl },
  };
  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: DETECT_MODEL_KEY,
    endpoint: DETECT_ENDPOINT,
    providerKind: "DASHSCOPE",
    requestKind: "IMAGE",
    clientSource: "EXTERNAL",
    clientPage: "account/ai-space?tab=digital-humans",
    actorBookUserId: args.userId,
    inputSummary: buildGatewayInputSummary(DETECT_MODEL_KEY, payload),
  });

  const started = Date.now();
  const s2vBaseUrl = resolveAiSpaceS2vBaseUrl(cred.apiKey, cred.baseUrl);
  const res = await dashscopeDetectS2vImage({
    apiKey: cred.apiKey,
    baseUrl: s2vBaseUrl,
    model: DETECT_MODEL_KEY,
    imageUrl: row.avatarImageUrl,
  });

  if (!res.ok) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failCode: "UPSTREAM_ERROR",
      failMessage: res.error,
      model: DETECT_MODEL_KEY,
    });
    throw new Error(res.error);
  }

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: Date.now() - started,
    resultSummary: {
      checkPass: res.result.checkPass,
      humanoid: res.result.humanoid,
      requestId: res.result.requestId,
    },
    model: DETECT_MODEL_KEY,
  });

  const detect: AiSpaceDigitalHumanDetect = {
    checkPass: res.result.checkPass,
    humanoid: res.result.humanoid,
    message: res.result.message,
    checkedAt: new Date().toISOString(),
    imageUrl: row.avatarImageUrl,
  };

  const baseMeta =
    row.meta && typeof row.meta === "object"
      ? (row.meta as Record<string, unknown>)
      : {};
  await prisma.aiSpaceDigitalHuman.update({
    where: { id: row.id },
    data: {
      meta: { ...baseMeta, detect } as never,
      // 用户手动停用的形象不因检测通过而自动启用
      status: detect.checkPass
        ? row.status === "detect_failed"
          ? "active"
          : row.status
        : "detect_failed",
    },
  });

  return detect;
}

/** 合成前门禁：已检测过就用缓存，未检测（或换过图）才调厂商 */
export async function ensureDigitalHumanS2vChecked(args: {
  userId: string;
  digitalHumanId: string;
  avatarImageUrl: string;
  meta: unknown;
}): Promise<AiSpaceDigitalHumanDetect> {
  const cached = readDigitalHumanDetect(args.meta, args.avatarImageUrl);
  if (cached) return cached;
  return detectAiSpaceDigitalHumanImage({
    userId: args.userId,
    digitalHumanId: args.digitalHumanId,
  });
}
