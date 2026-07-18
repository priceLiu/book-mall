/**
 * 校验百炼 Qwen 三模型经 Gateway BAILIAN 可调用。
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-bailian-qwen-models.ts [email]
 */
import { prisma } from "../lib/prisma";
import { resolveGatewayAuthForBookUser } from "../lib/gateway/book-gateway-link";
import {
  forwardChatCompletions,
  pickCredentialForKind,
} from "../lib/gateway/proxy-common";

const email = process.argv[2] ?? "13808816802@126.com";
const MODELS = ["qwen3.7-plus", "qwen3.5-plus", "qwen3-vl-plus"] as const;

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error("user not found:", email);
    process.exit(1);
  }

  const auth = await resolveGatewayAuthForBookUser(user.id);
  if (!auth) {
    console.error("no gateway auth for", email);
    process.exit(1);
  }

  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    console.error("no BAILIAN credential bound to user sk-gw");
    process.exit(1);
  }
  console.log(`user=${user.email} BAILIAN credentialId=${credentialId}`);

  let failed = 0;
  for (const model of MODELS) {
    try {
      const r = await forwardChatCompletions({
        credentialId,
        providerKind: "BAILIAN",
        body: {
          model,
          messages: [{ role: "user", content: "只回复：OK" }],
          max_tokens: 16,
        },
      });
      if (r.status < 200 || r.status >= 300) {
        console.error(`[fail] ${model} HTTP ${r.status}: ${r.text.slice(0, 200)}`);
        failed++;
        continue;
      }
      console.log(`[ok] ${model} → ${r.text.trim().slice(0, 60)}`);
    } catch (e) {
      console.error(`[fail] ${model}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  if (failed > 0) process.exit(1);
  console.log("全部 Qwen 模型连通性校验通过。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
