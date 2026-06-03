/**
 * 冒烟：火山方舟 Gateway Chat
 *
 *   cd book-mall && VOLCENGINE_API_KEY=xxx pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-gateway.ts
 */
import { forwardChatCompletions } from "../lib/gateway/proxy-common";
import { prisma } from "../lib/prisma";

async function main() {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { providerKind: "VOLCENGINE", active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    console.error("未找到 VOLCENGINE 凭证，请先 seed 或控制台添加");
    process.exit(1);
  }

  const model = process.argv[2]?.trim() || "doubao-seed-2.0-lite";
  const r = await forwardChatCompletions({
    credentialId: row.id,
    providerKind: "VOLCENGINE",
    body: {
      model,
      messages: [{ role: "user", content: "回复 OK 两个字母" }],
      max_tokens: 16,
    },
  });
  console.log("status", r.status, "ms", r.durationMs);
  console.log(r.text.slice(0, 500));
  if (r.status >= 400) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
