/* eslint-disable no-console */
/**
 * 校验「我的 AI 空间」依赖的 Gateway 模型与凭证绑定。
 *
 *   cd book-mall && pnpm gateway:verify-ai-space
 *
 * 凭证按 providerKind 绑定（非按模型），所以只要 DASHSCOPE / BAILIAN 各有一条
 * active 凭证挂在用户的 sk-gw 上，新增模型即可直接调用。
 */
import { prisma } from "../lib/prisma";

const MODEL_KEYS = [
  "wan2.2-s2v",
  "wan2.2-s2v-detect",
  "cosyvoice-v3-flash",
  "qwen3-tts",
] as const;
const PROVIDER_KINDS = ["DASHSCOPE", "BAILIAN"] as const;

async function main() {
  console.log("== 模型登记 ==");
  for (const modelKey of MODEL_KEYS) {
    const route = await prisma.gatewayModelRoute.findFirst({
      where: { modelKey, active: true },
      select: { canonicalModelKey: true, providerKind: true, vendor: true },
    });
    if (!route) {
      console.error(`[缺失] ${modelKey} 无 active 路由，请跑 pnpm gateway:seed-registry`);
      continue;
    }
    const cat = await prisma.modelCatalog.findUnique({
      where: { canonicalKey: route.canonicalModelKey },
      select: { displayName: true, gatewayPublished: true, active: true },
    });
    console.log(
      `[ok] ${modelKey} → ${route.canonicalModelKey} (${route.providerKind}/${route.vendor})` +
        ` published=${cat?.gatewayPublished} active=${cat?.active}`,
    );
  }

  console.log("\n== 最近合成任务（排查单飞队列是否卡住） ==");
  const tasks = await prisma.aiSpaceComposeTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      status: true,
      gatewayTaskId: true,
      mediaRenderJobId: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (tasks.length === 0) console.log("(无)");
  for (const t of tasks) {
    console.log(
      `[${t.status}] ${t.id} vendorTask=${t.gatewayTaskId ?? "-"} renderJob=${t.mediaRenderJobId ?? "-"}` +
        ` created=${t.createdAt.toLocaleString("zh-CN")} updated=${t.updatedAt.toLocaleString("zh-CN")}` +
        (t.errorMessage ? ` err=${t.errorMessage.slice(0, 120)}` : ""),
    );
  }
  const inFlight = await prisma.aiSpaceComposeTask.count({
    where: { status: "generating_human" },
  });
  console.log(`generating_human 在飞数：${inFlight}（>0 时新任务会一直排队）`);

  console.log("\n== 积分单价（缺失不阻断生成，但平台代付将不计费） ==");
  for (const modelKey of MODEL_KEYS) {
    const route = await prisma.gatewayModelRoute.findFirst({
      where: { modelKey, active: true },
      select: { canonicalModelKey: true },
    });
    if (!route) continue;
    const price = await prisma.modelCreditPrice.findFirst({
      where: { canonicalModelKey: route.canonicalModelKey, active: true },
      select: { unit: true, creditsPerUnit: true, vendor: true },
    });
    console.log(
      price
        ? `[ok] ${route.canonicalModelKey} ${price.creditsPerUnit} 积分/${price.unit}（${price.vendor}）`
        : `[缺失] ${route.canonicalModelKey} 无 active 积分单价 → 平台代付用户调用不扣积分，请在 /admin/model-credit-ledger 发布`,
    );
  }

  console.log("\n== 厂商凭证（按 providerKind） ==");
  for (const providerKind of PROVIDER_KINDS) {
    const creds = await prisma.gatewayVendorCredential.findMany({
      where: { providerKind, active: true },
      select: {
        id: true,
        alias: true,
        channel: true,
        isDefaultForProvider: true,
        user: { select: { bookUserId: true } },
      },
      take: 20,
    });
    if (creds.length === 0) {
      console.error(
        `[缺失] ${providerKind} 无 active 凭证，请在 Gateway 模型管理页绑定阿里云 Key`,
      );
      continue;
    }
    for (const c of creds) {
      const bindings = await prisma.gatewayApiKeyCredential.findMany({
        where: { credentialId: c.id, apiKey: { revokedAt: null } },
        select: { apiKey: { select: { name: true } } },
      });
      console.log(
        `[ok] ${providerKind} ${c.alias ?? "(无别名)"} channel=${c.channel}` +
          ` default=${c.isDefaultForProvider} bookUser=${c.user?.bookUserId ?? "-"}` +
          ` keys=[${bindings.map((b) => b.apiKey.name).join(", ") || "未绑定"}]`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
