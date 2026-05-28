/**
 * 打印 BAILIAN 凭证实际请求 URL 与上游响应（调试用）
 * 用法：pnpm exec dotenv -e .env.local -- tsx scripts/debug-bailian-chat-url.ts [email]
 */
import { prisma } from "../lib/prisma";
import { resolveGatewayAuthForBookUser } from "../lib/gateway/book-gateway-link";
import { pickCredentialForKind } from "../lib/gateway/proxy-common";
import { forwardChatCompletions } from "../lib/gateway/proxy-common";
import { resolveOpenAiCompatibleBaseUrl } from "../lib/gateway/model-router";
import { getDecryptedCredentialApiKey } from "../lib/gateway/credential-service";

const email = process.argv[2] ?? "13808816802@126.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    console.log("user not found");
    return;
  }
  const auth = await resolveGatewayAuthForBookUser(user.id);
  if (!auth) {
    console.log("no gateway auth");
    return;
  }
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    console.log("no BAILIAN credential");
    return;
  }
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    console.log("credential decrypt failed");
    return;
  }
  const base = resolveOpenAiCompatibleBaseUrl("BAILIAN", cred.baseUrl);
  const url = `${base}/chat/completions`;
  console.log("providerKind", cred.providerKind);
  console.log("baseUrl", base);
  console.log("requestUrl", url);
  console.log("apiKeyPrefix", cred.apiKey.slice(0, 8) + "…");

  for (const model of ["qwen-vl-plus", "qwen3.6-plus"]) {
    const r = await forwardChatCompletions({
      credentialId,
      providerKind: "BAILIAN",
      body: {
        model,
        messages: [{ role: "user", content: "你好" }],
      },
    });
    console.log("\n---", model, "status", r.status, "---");
    console.log(r.text.slice(0, 600));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
