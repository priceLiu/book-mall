/**
 * 验证提示词优化器 Gateway 模型路由与试点账号凭证绑定。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/verify-prompt-optimizer-gateway.ts
 */
import { listPromptOptimizerGatewayModels } from "../lib/gateway/prompt-optimizer-chat-models";
import { routeGatewayModel } from "../lib/gateway/model-router";
import {
  getGatewayLinkStatusForUser,
} from "../lib/gateway/book-gateway-link";
import { prisma } from "../lib/prisma";

const PILOT_EMAIL = "13808816802@126.com";

async function main() {
  console.log("=== 提示词优化器 · Gateway 模型路由 ===\n");
  for (const modelKey of [
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "qwen3.5-27b",
    "MiniMax-M2.5",
  ]) {
    const routed = routeGatewayModel(modelKey);
    console.log(`${modelKey} → ${routed.providerKind} / ${routed.requestKind}`);
  }

  const user = await prisma.user.findUnique({
    where: { email: PILOT_EMAIL.trim().toLowerCase() },
  });
  if (!user) {
    console.warn(`\n[warn] 用户 ${PILOT_EMAIL} 不存在，跳过关联检查`);
    return;
  }

  const link = await getGatewayLinkStatusForUser(user.id);
  const models = listPromptOptimizerGatewayModels(link.boundKinds ?? []);

  console.log(`\n=== ${PILOT_EMAIL} Gateway 关联 ===`);
  console.log(
    JSON.stringify(
      {
        linked: link.linked,
        keyName: link.keyName,
        boundKinds: link.boundKinds,
      },
      null,
      2,
    ),
  );

  console.log("\n=== 提示词优化器可用模型 ===");
  for (const m of models) {
    const flag = m.credentialBound ? "✓" : "✗";
    console.log(`${flag} ${m.modelKey} (${m.providerKind}) — ${m.displayName}`);
  }

  const missing = models.filter((m) => !m.credentialBound);
  if (missing.length) {
    console.warn(
      `\n[warn] 未绑定凭证的厂商: ${[...new Set(missing.map((m) => m.providerKind))].join(", ")}`,
    );
    console.warn("请运行: pnpm exec dotenv -e .env.local -- tsx scripts/seed-pilot-gateway.ts");
  } else {
    console.log("\n[ok] 所需厂商凭证均已绑定");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
