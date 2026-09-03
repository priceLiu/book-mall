/**
 * 冒烟：百炼视频理解新模型经 Gateway BAILIAN 平台代付可调用。
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-video-understanding-models.ts [email]
 */
import { prisma } from "../lib/prisma";
import { resolveGatewayAuthForBookUser } from "../lib/gateway/book-gateway-link";
import {
  forwardChatCompletions,
  pickCredentialForKind,
  resolveGatewayChatCompletionsBody,
} from "../lib/gateway/proxy-common";
import { assertModelRegistered } from "../lib/gateway/model-registry";
import { routeGatewayModel } from "../lib/gateway/model-router";

const email = process.argv[2] ?? "13808816802@126.com";

const SAMPLE_IMAGE =
  "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/ctdzex/biaozhun.jpg";

const MODELS = [
  { modelKey: "qwen3-omni-flash", label: "Qwen3-Omni Flash" },
  { modelKey: "qwen2.5-vl-72b-instruct", label: "Qwen2.5-VL 72B" },
  { modelKey: "glm-5.3-flash", label: "GLM-5.3 Flash" },
] as const;

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
  for (const { modelKey, label } of MODELS) {
    try {
      const route = routeGatewayModel(modelKey);
      const reg = await assertModelRegistered(modelKey);
      console.log(`[registry] ${modelKey} → ${reg.canonicalModelKey} (${route.providerKind})`);

      const body: Record<string, unknown> = {
        model: modelKey,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: SAMPLE_IMAGE } },
              { type: "text", text: "只回复一个词：看到了" },
            ],
          },
        ],
        max_tokens: 32,
      };
      if (modelKey === "glm-5.3-flash") {
        body.enable_thinking = true;
        body.reasoning_effort = "low";
      }

      const requestBody = resolveGatewayChatCompletionsBody("BAILIAN", body);
      const r = await forwardChatCompletions({
        credentialId,
        providerKind: "BAILIAN",
        body: requestBody,
      });
      if (r.status < 200 || r.status >= 300) {
        console.error(
          `[fail] ${label} HTTP ${r.status}: ${r.text.slice(0, 400)}`,
        );
        failed++;
        continue;
      }
      const parsed = JSON.parse(r.text) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = parsed.choices?.[0]?.message?.content?.trim() ?? r.text.slice(0, 80);
      console.log(`[ok] ${label} (${modelKey}) upstream=${requestBody.model} → ${content.slice(0, 80)}`);
    } catch (e) {
      console.error(`[fail] ${label}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  if (failed > 0) process.exit(1);
  console.log("全部视频理解模型连通性校验通过。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
