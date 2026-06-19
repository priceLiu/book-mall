/**
 * 分镜视频 1.0 · 真人人像 H5 活体认证（经用户 Gateway VOLCENGINE 凭证）
 * GroupId 持久化在 Book User 账号级，与画布节点无关。
 *
 * 鉴权与私域虚拟人入库相同：Gateway「火山方舟 · 分镜视频1.0」凭证 → IAM AK/SK → open.volcengineapi.com
 */

import { CanvasProjectError } from "./canvas-project-service";
import { getBookMallOrigin } from "@/lib/gateway/env";
import {
  createRequestLog,
  finalizeRequestLog,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { SBV1_VOLCENGINE_CREDENTIAL_ALIAS } from "@/lib/gateway/volcengine-credential-pick";
import { prisma } from "@/lib/prisma";
import {
  createVolcengineVisualValidateSession,
  getVolcengineVisualValidateResult,
  type VolcenginePortraitLivenessResult,
  type VolcenginePortraitLivenessSession,
} from "@/lib/gateway/volcengine-portrait-liveness";
import {
  resolveCanvasPortraitVolcengineCredential,
  SBV1_PORTRAIT_LIVENESS_CLIENT_PAGE,
} from "./canvas-portrait-volcengine-credential";
import {
  getSbv1PortraitLivenessCallback,
  getSbv1PortraitLivenessSessionOwner,
  saveSbv1PortraitLivenessCallback,
  saveSbv1PortraitLivenessSession,
} from "./sbv1-portrait-liveness-callback-store";

export { SBV1_VOLCENGINE_CREDENTIAL_ALIAS };

export type Sbv1PortraitLivenessStatus = {
  verified: boolean;
  groupId?: string;
  verifiedAt?: string;
};

const CLIENT_PAGE = SBV1_PORTRAIT_LIVENESS_CLIENT_PAGE;

function buildCallbackUrl(): string {
  const origin = getBookMallOrigin();
  if (!origin) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "BOOK_MALL_ORIGIN / NEXTAUTH_URL 未配置，无法生成活体 CallbackURL",
      500,
    );
  }
  return `${origin.replace(/\/$/, "")}/api/canvas/sbv1/portrait/liveness/callback`;
}

export async function getSbv1PortraitLivenessStatus(
  userId: string,
): Promise<Sbv1PortraitLivenessStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      sbv1PortraitGroupId: true,
      sbv1PortraitLivenessAt: true,
    },
  });
  const groupId = user?.sbv1PortraitGroupId?.trim() || undefined;
  return {
    verified: Boolean(groupId),
    groupId,
    verifiedAt: user?.sbv1PortraitLivenessAt?.toISOString(),
  };
}

async function saveSbv1PortraitLivenessSuccess(
  userId: string,
  groupId: string,
): Promise<void> {
  const trimmed = groupId.trim();
  if (!trimmed) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      sbv1PortraitGroupId: trimmed,
      sbv1PortraitLivenessAt: new Date(),
    },
  });
}

export async function sbv1CreatePortraitLivenessSession(
  userId: string,
): Promise<VolcenginePortraitLivenessSession & { expiresInSec: number }> {
  const {
    gatewayUserId,
    apiKeyId,
    credentialId,
    portraitCredentials,
  } = await resolveCanvasPortraitVolcengineCredential({
    userId,
    clientPage: CLIENT_PAGE,
  });

  const callbackUrl = buildCallbackUrl();
  const log = await createRequestLog({
    userId: gatewayUserId,
    actorBookUserId: userId,
    apiKeyId,
    credentialId,
    clientPage: CLIENT_PAGE,
    model: "portrait:liveness",
    endpoint: "/canvas/sbv1/portrait/liveness/session",
    providerKind: "VOLCENGINE",
    requestKind: "OTHER",
    clientSource: "CANVAS",
    inputSummary: buildGatewayInputSummary("portrait:liveness", {
      action: "CreateVisualValidateSession",
      callbackUrl,
    }),
  });

  const started = Date.now();
  try {
    const session = await createVolcengineVisualValidateSession({
      credentials: portraitCredentials,
      callbackUrl,
    });
    saveSbv1PortraitLivenessSession(userId, session.bytedToken);
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
      resultSummary: { hasH5Link: Boolean(session.h5Link) },
    });
    return { ...session, expiresInSec: 30 * 60 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: msg.slice(0, 500),
    });
    throw new CanvasProjectError("MODEL_NOT_AVAILABLE", msg, 502);
  }
}

export async function sbv1PollPortraitLivenessResult(
  userId: string,
  bytedToken: string,
): Promise<VolcenginePortraitLivenessResult> {
  const token = bytedToken.trim();
  if (!token) {
    throw new CanvasProjectError("INVALID_INPUT", "缺少 bytedToken", 400);
  }

  const sessionOwner = getSbv1PortraitLivenessSessionOwner(token);
  if (sessionOwner && sessionOwner !== userId) {
    throw new CanvasProjectError(
      "FORBIDDEN",
      "无权查询该活体会话",
      403,
    );
  }
  if (!sessionOwner && !getSbv1PortraitLivenessCallback(token)) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "活体会话已过期，请重新发起认证",
      400,
    );
  }

  const callback = getSbv1PortraitLivenessCallback(token);
  if (callback?.resultCode && callback.resultCode !== "10000") {
    return {
      status: "failed",
      message: `H5 活体认证未通过（resultCode=${callback.resultCode}）`,
      raw: callback,
    };
  }

  // 文档要求：H5 完成且 resultCode=10000 后再调用 GetVisualValidateResult
  if (!callback || callback.resultCode !== "10000") {
    return {
      status: "pending",
      message: "等待 H5 活体认证完成",
      raw: callback,
    };
  }

  const {
    gatewayUserId,
    apiKeyId,
    credentialId,
    portraitCredentials,
  } = await resolveCanvasPortraitVolcengineCredential({
    userId,
    clientPage: CLIENT_PAGE,
  });

  const log = await createRequestLog({
    userId: gatewayUserId,
    actorBookUserId: userId,
    apiKeyId,
    credentialId,
    clientPage: CLIENT_PAGE,
    model: "portrait:liveness",
    endpoint: "/canvas/sbv1/portrait/liveness/result",
    providerKind: "VOLCENGINE",
    requestKind: "OTHER",
    clientSource: "CANVAS",
    inputSummary: buildGatewayInputSummary("portrait:liveness", {
      action: "GetVisualValidateResult",
    }),
  });

  const started = Date.now();
  try {
    const result = await getVolcengineVisualValidateResult({
      credentials: portraitCredentials,
      bytedToken: token,
    });
    if (result.status === "succeeded" && result.groupId) {
      await saveSbv1PortraitLivenessSuccess(userId, result.groupId);
      await finalizeRequestLog(log.id, {
        status: "SUCCEEDED",
        durationMs: Date.now() - started,
        resultSummary: { groupId: result.groupId },
      });
    } else if (result.status === "failed") {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: result.message?.slice(0, 500),
      });
    } else {
      await finalizeRequestLog(log.id, {
        status: "SUCCEEDED",
        durationMs: Date.now() - started,
        resultSummary: { status: "pending" },
      });
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: msg.slice(0, 500),
    });
    throw e instanceof CanvasProjectError
      ? e
      : new CanvasProjectError("UPSTREAM_ERROR", msg, 502);
  }
}

export function sbv1RecordPortraitLivenessCallback(
  bytedToken: string,
  resultCode: string | undefined,
): void {
  saveSbv1PortraitLivenessCallback(bytedToken, resultCode);
}
