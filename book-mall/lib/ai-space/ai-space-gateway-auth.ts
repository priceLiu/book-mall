/**
 * 我的 AI 空间 · 阿里云（DashScope / 百炼）Gateway 鉴权
 *
 * 凭证按 `providerKind` 绑定，S2V / 形象检测 / CosyVoice 共用同一把用户 `sk-gw`。
 */

import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";

export async function requireAiSpaceDashscopeAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在个人中心关联 Gateway API Key");
  }
  const credentialId =
    pickCredentialForKind(auth.credentials, "DASHSCOPE") ??
    pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new GatewayRequiredError(
      "Gateway Key 未绑定阿里云（百炼 / DashScope）凭证，请在 Gateway 模型管理页绑定后重试",
    );
  }
  return { auth, credentialId };
}
