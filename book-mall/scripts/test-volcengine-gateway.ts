/**
 * 冒烟：火山方舟 Gateway Chat / Video
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-gateway.ts
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-gateway.ts --video
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/test-volcengine-gateway.ts --video ep-xxx
 */
import {
  createRequestLog,
  forwardChatCompletions,
} from "../lib/gateway/proxy-common";
import { routeGatewayModel } from "../lib/gateway/model-router";
import {
  pollVolcengineVideoTaskForLog,
  submitVolcengineVideoJobForLog,
} from "../lib/gateway/volcengine-jobs";
import { prisma } from "../lib/prisma";

const args = process.argv.slice(2);
const videoMode = args.includes("--video");
const epModel = args.find((a) => a.startsWith("ep-"));

async function main() {
  const row = await prisma.gatewayVendorCredential.findFirst({
    where: { providerKind: "VOLCENGINE", active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    console.error("未找到 VOLCENGINE 凭证，请先 seed 或控制台添加");
    process.exit(1);
  }

  const apiKey = await prisma.gatewayApiKey.findFirst({
    where: {
      bindings: { some: { credentialId: row.id } },
      revokedAt: null,
    },
    select: { id: true, userId: true },
  });

  if (videoMode) {
    const model = epModel ?? process.argv.find((a) => !a.startsWith("--"))?.trim() ?? "doubao-seedance-2.0";
    const route = routeGatewayModel(model);
    console.log("route", route, "model", model);
    if (!apiKey) {
      console.error("未找到绑定该凭证的 sk-gw");
      process.exit(1);
    }
    const log = await createRequestLog({
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
      credentialId: row.id,
      model,
      endpoint: "/test/volcengine/video",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      clientSource: "TOOL",
      inputSummary: { smoke: true },
    });
    const taskId = await submitVolcengineVideoJobForLog({
      logId: log.id,
      credentialId: row.id,
      model,
      body: {
        content: [{ type: "text", text: "一只橘猫在阳光下打盹，镜头缓慢推进。" }],
        ratio: "16:9",
        duration: 5,
        watermark: false,
      },
    });
    console.log("taskId", taskId);
    const started = Date.now();
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const done = await pollVolcengineVideoTaskForLog({
        logId: log.id,
        credentialId: row.id,
        taskId,
        startedAt: started,
      });
      console.log("poll", i + 1, done);
      if (done === "done") break;
    }
    return;
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
