/**
 * 提示词优化器 · Gateway Chat 冒烟（DeepSeek / 百炼 Qwen / MiniMax）
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-prompt-optimizer-chat-gateway.ts
 */
import { assertGatewayApiKeyLinkedForUser } from "../lib/gateway/book-gateway-link";
import { assertPlatformGatewayEntitlement } from "../lib/platform-gateway-entitlement";
import { routeGatewayModel } from "../lib/gateway/model-router";
import { toolGwChatStream } from "../lib/gateway/tool-gateway-client";
import { prisma } from "../lib/prisma";

const PILOT_EMAIL = "13808816802@126.com";

const MODELS = [
  "deepseek-v4-flash",
  "qwen3.5-27b",
  "MiniMax/MiniMax-M2.7",
  "MiniMax-M2.5",
  "gemini-2.5-flash",
] as const;

async function readStreamPreview(
  body: ReadableStream<Uint8Array>,
  maxChunks = 8,
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

async function testModel(
  userId: string,
  modelKey: string,
): Promise<{ ok: boolean; detail: string }> {
  const route = routeGatewayModel(modelKey);
  try {
    const streamed = await toolGwChatStream(userId, {
      modelKey,
      messages: [
        {
          role: "user",
          content: "请只回复两个字：收到",
        },
      ],
      params: { max_tokens: 32, temperature: 0 },
      clientPage: "prompt-optimizer",
    });

    if (streamed.status >= 400) {
      const preview = await readStreamPreview(streamed.body, 4);
      return {
        ok: false,
        detail: `HTTP ${streamed.status} · ${preview || "(empty)"}`,
      };
    }

    const preview = await readStreamPreview(streamed.body);
    const hasContent =
      preview.includes("收到") ||
      preview.includes("content") ||
      preview.includes("data:");
    return {
      ok: hasContent,
      detail: hasContent
        ? `stream ${streamed.status} · log ${streamed.logId} · ${preview.slice(0, 120).replace(/\s+/g, " ")}…`
        : `empty or unexpected · ${preview.slice(0, 200)}`,
    };
  } catch (e) {
    return { ok: false, detail: `${route.providerKind}: ${(e as Error).message}` };
  }
}

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: PILOT_EMAIL.trim().toLowerCase() },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.error(`用户不存在: ${PILOT_EMAIL}`);
    process.exit(1);
  }
  console.log(`用户: ${user.email} (${user.role})\n`);

  try {
    await assertGatewayApiKeyLinkedForUser(user.id);
    console.log("[ok] Gateway Personal Key 已关联");
  } catch (e) {
    console.error("[fail] Gateway 未关联:", (e as Error).message);
    process.exit(1);
  }

  try {
    await assertPlatformGatewayEntitlement(user.id, {
      navKey: "prompt-optimizer",
    });
    console.log("[ok] 工具准入 / prompt-optimizer 服务期\n");
  } catch (e) {
    console.warn(
      "[warn] 准入检查:",
      (e as Error).message,
      "（管理员账号通常可忽略，继续测 Chat）\n",
    );
  }

  let failed = 0;
  for (const modelKey of MODELS) {
    const route = routeGatewayModel(modelKey);
    process.stdout.write(`→ ${modelKey} (${route.providerKind}) … `);
    const result = await testModel(user.id, modelKey);
    if (result.ok) {
      console.log("OK");
      console.log(`  ${result.detail}\n`);
    } else {
      failed++;
      console.log("FAIL");
      console.log(`  ${result.detail}\n`);
    }
  }

  if (failed > 0) {
    console.error(`[done] ${MODELS.length - failed}/${MODELS.length} 通过`);
    process.exit(1);
  }
  console.log(`[done] ${MODELS.length}/${MODELS.length} 全部通过`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
