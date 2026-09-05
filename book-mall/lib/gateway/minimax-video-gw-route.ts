import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";

export async function requireMinimaxVideoCredential(auth: ResolvedGatewayApiKeyAuth) {
  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return { error: "No MINIMAX credential bound" as const, status: 400 as const };
  }
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred?.apiKey?.trim()) {
    return { error: "MiniMax credential unavailable" as const, status: 503 as const };
  }
  return { credentialId, cred };
}
