/**
 * Canvas · 私域人像（虚拟入库 / 真人活体）· Gateway VOLCENGINE 凭证解析
 * 与 canvas-portrait-import-service 共用同一选用逻辑与 IAM AK/SK 解析。
 */

import { CanvasProjectError } from "./canvas-project-service";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import {
  pickSbv1VolcengineCredentialId,
  pickVolcengineCredentialForGatewayJob,
} from "@/lib/gateway/volcengine-credential-pick";
import {
  resolveVolcenginePortraitCredentials,
  type VolcenginePortraitIam,
} from "@/lib/gateway/volcengine-portrait-credentials";

export type CanvasPortraitVolcengineCredential = {
  gatewayUserId: string;
  apiKeyId: string;
  credentialId: string;
  apiKey: string;
  baseUrl: string | null;
  /** open.volcengineapi.com · IAM AK/SK 签名 */
  portraitCredentials: VolcenginePortraitIam;
};

/** sbv1 账号级活体 · 与虚拟入库相同的 Gateway 凭证别名链 */
export const SBV1_PORTRAIT_LIVENESS_CLIENT_PAGE = "canvas/sbv1/portrait/liveness";

export async function resolveCanvasPortraitVolcengineCredential(opts: {
  userId: string;
  clientPage: string;
}): Promise<CanvasPortraitVolcengineCredential> {
  const auth = await resolveGatewayAuthForBookUser(opts.userId);
  if (!auth) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "请先在 Book 个人中心关联 Gateway API Key",
      403,
    );
  }

  const sbv1 = opts.clientPage.includes("/sbv1");
  const credentialId = sbv1
    ? pickSbv1VolcengineCredentialId(auth.credentials)
    : pickVolcengineCredentialForGatewayJob({
        credentials: auth.credentials,
        modelKey: "doubao-seedance-2.0",
        clientPage: opts.clientPage,
        input: null,
        providerId: null,
      });

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

  let portraitCredentials: VolcenginePortraitIam;
  try {
    portraitCredentials = resolveVolcenginePortraitCredentials(cred.apiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new CanvasProjectError("GATEWAY_KEY_REQUIRED", msg, 403);
  }

  return {
    gatewayUserId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl ?? null,
    portraitCredentials,
  };
}
