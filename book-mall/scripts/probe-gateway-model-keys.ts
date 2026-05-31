/**
 * 探测 Gateway Chat 模型 key 是否可用（本地一次性脚本）
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/probe-gateway-model-keys.ts
 */
import { toolGwChatStream } from "../lib/gateway/tool-gateway-client";
import { routeGatewayModel } from "../lib/gateway/model-router";
import { prisma } from "../lib/prisma";

const PILOT_EMAIL = "13808816802@126.com";

const CANDIDATES = [
  "MiniMax-M2.7",
  "MiniMax/MiniMax-M2.7",
  "MiniMax-M2.7-highspeed",
  "MiniMax/MiniMax-M2.7-highspeed",
  "gemini-2.5-flash",
  "google/gemini-2.5-flash",
] as const;

async function readPreview(
  body: ReadableStream<Uint8Array>,
  maxChunks = 4,
): Promise<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  const parts: string[] = [];
  try {
    for (let i = 0; i < maxChunks; i++) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(dec.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  return parts.join("").slice(0, 400);
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: PILOT_EMAIL.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error("user not found");
    process.exit(1);
  }
  console.log(`user: ${user.email}\n`);

  for (const modelKey of CANDIDATES) {
    const route = routeGatewayModel(modelKey);
    process.stdout.write(`→ ${modelKey} (${route.providerKind}) … `);
    try {
      const streamed = await toolGwChatStream(user.id, {
        modelKey,
        messages: [{ role: "user", content: "请只回复：收到" }],
        params: { max_tokens: 32, temperature: 0 },
        clientPage: "prompt-optimizer",
      });
      const preview = await readPreview(streamed.body);
      if (streamed.status >= 400) {
        console.log(`FAIL HTTP ${streamed.status}`);
        console.log(`  ${preview.replace(/\s+/g, " ").slice(0, 200)}\n`);
        continue;
      }
      console.log(`OK HTTP ${streamed.status}`);
      console.log(`  ${preview.replace(/\s+/g, " ").slice(0, 160)}\n`);
    } catch (e) {
      console.log(`ERR ${(e as Error).message}\n`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
