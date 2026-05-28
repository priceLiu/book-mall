/**
 * 本地调试：模拟分析室 qwen3.6-plus 走 Gateway chat
 * 用法：pnpm exec dotenv -e .env.local -- tsx scripts/test-visual-lab-chat-gateway.ts [email]
 */
import { prisma } from "../lib/prisma";
import { toolGwChatStream } from "../lib/gateway/tool-gateway-client";
import { assertGatewayApiKeyLinkedForUser } from "../lib/gateway/book-gateway-link";
import { assertPlatformGatewayEntitlement } from "../lib/platform-gateway-entitlement";

const email = process.argv[2] ?? "13808816802@126.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.log("user not found");
    return;
  }
  console.log("user", user.email, user.id, user.role);

  try {
    await assertGatewayApiKeyLinkedForUser(user.id);
    console.log("gateway link: ok");
  } catch (e) {
    console.log("gateway link FAIL", (e as Error).message);
    return;
  }

  try {
    await assertPlatformGatewayEntitlement(user.id, { navKey: "visual-lab" });
    console.log("entitlement: ok");
  } catch (e) {
    console.log("entitlement FAIL", (e as Error).message);
    return;
  }

  const modelKey = process.argv[3] ?? "qwen3.6-plus";
  console.log("modelKey", modelKey);

  try {
    const streamed = await toolGwChatStream(user.id, {
      modelKey,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: "https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg",
              },
            },
            { type: "text", text: "用一句话描述这张图" },
          ],
        },
      ],
      params: { enable_thinking: true, thinking_budget: 8192 },
      clientPage: "visual-lab/analysis",
    });
    console.log("stream started", streamed.status, streamed.logId);
    const reader = streamed.body.getReader();
    const dec = new TextDecoder();
    let n = 0;
    while (n < 5) {
      const { done, value } = await reader.read();
      if (done) break;
      console.log("chunk", dec.decode(value).slice(0, 200));
      n++;
    }
    reader.releaseLock();
    console.log("stream ok (first chunks)");
  } catch (e) {
    console.log("chat FAIL", (e as Error).message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
