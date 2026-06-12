/**
 * 分镜视频 1.0 · 真人人像 H5 活体认证（经用户 Gateway VOLCENGINE 凭证）
 */

import { CanvasProjectError } from "./canvas-project-service";
import { getBookMallOrigin } from "@/lib/gateway/env";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import {
  createVolcengineVisualValidateSession,
  getVolcengineVisualValidateResult,
  type VolcenginePortraitLivenessResult,
  type VolcenginePortraitLivenessSession,
} from "@/lib/gateway/volcengine-portrait-liveness";
import {
  getSbv1PortraitLivenessCallback,
  saveSbv1PortraitLivenessCallback,
} from "./sbv1-portrait-liveness-callback-store";

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

async function volcengineCredentialForUser(userId: string) {
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "请先在 Book 个人中心关联 Gateway API Key",
      403,
    );
  }
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "Gateway Key 未绑定火山方舟（VOLCENGINE）凭证",
      403,
    );
  }
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred?.apiKey) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "火山方舟凭证不可用",
      503,
    );
  }
  return cred;
}

export async function sbv1CreatePortraitLivenessSession(
  userId: string,
): Promise<VolcenginePortraitLivenessSession & { expiresInSec: number }> {
  const cred = await volcengineCredentialForUser(userId);
  const callbackUrl = buildCallbackUrl();
  try {
    const session = await createVolcengineVisualValidateSession({
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
      callbackUrl,
    });
    return { ...session, expiresInSec: 120 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
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

  const callback = getSbv1PortraitLivenessCallback(token);
  if (callback?.resultCode && callback.resultCode !== "10000") {
    return {
      status: "failed",
      message: `H5 活体认证未通过（resultCode=${callback.resultCode}）`,
      raw: callback,
    };
  }

  const cred = await volcengineCredentialForUser(userId);
  return getVolcengineVisualValidateResult({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    bytedToken: token,
  });
}

export function sbv1RecordPortraitLivenessCallback(
  bytedToken: string,
  resultCode: string | undefined,
): void {
  saveSbv1PortraitLivenessCallback(bytedToken, resultCode);
}
