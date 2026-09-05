/**
 * 从历史 PlatformDocChunk 回填 text-embedding-v3 GatewayRequestLog（对账用）。
 *
 * assistant:index 多次全量重建时阿里累计计费，但库内仅保留最终 chunk；
 * 本脚本按入库 batch（10 条/批）补写日志，可选 --scale 放大 token 以贴近厂商 CSV。
 *
 * 用法：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-embedding-gateway-logs-from-chunks.ts --dry
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-embedding-gateway-logs-from-chunks.ts --apply --since=2026-08-01 --until=2026-09-01 --scale=5.334
 */
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { resolveGatewayApiKeyById } from "@/lib/gateway/api-key-service";
import { getCanonicalPlatformPoolOwnerEmail } from "@/lib/gateway/platform-credential-copy";
import { findPlatformAdminApiKey } from "@/lib/gateway/platform-credential-pool";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");
const BACKFILL_CLIENT_PAGE = "reconciliation-backfill/embedding-chunks";
const MODEL = "text-embedding-v3";
const BATCH = 10;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const sinceStr = arg("since") ?? "2026-08-01";
  const untilStr = arg("until") ?? "2026-09-01";
  const scale = Number(arg("scale") ?? "1");
  const since = new Date(`${sinceStr}T00:00:00+08:00`);
  const until = new Date(`${untilStr}T00:00:00+08:00`);

  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("--scale 须为正数");
  }

  console.log(
    `MODE: ${APPLY ? "APPLY" : "DRY"} · since=${sinceStr} until=${untilStr} · scale=${scale}`,
  );

  const existing = await prisma.gatewayRequestLog.count({
    where: { clientPage: BACKFILL_CLIENT_PAGE, submittedAt: { gte: since, lt: until } },
  });
  if (existing > 0) {
    console.log(`已存在 ${existing} 条回填日志，跳过（删 clientPage=${BACKFILL_CLIENT_PAGE} 后可重跑）`);
    return;
  }

  const chunks = await prisma.platformDocChunk.findMany({
    where: { createdAt: { gte: since, lt: until } },
    select: { id: true, tokens: true, createdAt: true, source: true },
    orderBy: { createdAt: "asc" },
  });
  if (chunks.length === 0) {
    console.log("无 PlatformDocChunk，跳过");
    return;
  }

  const platformKey = await findPlatformAdminApiKey();
  if (!platformKey?.id || !platformKey.userId) {
    throw new Error("平台 Gateway Key 未就绪");
  }
  const ownerEmail = getCanonicalPlatformPoolOwnerEmail();
  const bookUser = await prisma.user.findFirst({
    where: { email: ownerEmail },
    select: { id: true },
  });
  if (!bookUser) {
    throw new Error(`Book 用户不存在: ${ownerEmail}`);
  }
  const auth = await resolveGatewayApiKeyById(platformKey.id);
  if (!auth) throw new Error("平台 Gateway Key 无效");
  const route = routeGatewayModel(MODEL);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new Error(`平台凭证未绑定 ${route.providerKind}`);
  }

  let created = 0;
  let totalTokens = 0;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const batchTokens = Math.round(
      batch.reduce((s, c) => s + Math.max(c.tokens, 1), 0) * scale,
    );
    totalTokens += batchTokens;
    const submittedAt = batch[0]?.createdAt ?? since;

    console.log(
      `[${APPLY ? "apply" : "dry"}] batch ${Math.floor(i / BATCH) + 1} · chunks=${batch.length} · tokens=${batchTokens}`,
    );

    if (APPLY) {
      await prisma.gatewayRequestLog.create({
        data: {
          userId: platformKey.userId,
          apiKeyId: platformKey.id,
          credentialId,
          providerKind: route.providerKind,
          model: MODEL,
          canonicalModelKey: MODEL,
          endpoint: "/v1/embeddings",
          requestKind: "OTHER",
          status: "SUCCEEDED",
          clientSource: "TOOL",
          clientPage: BACKFILL_CLIENT_PAGE,
          actorBookUserId: bookUser.id,
          billingMode: "PLATFORM_CREDIT",
          promptTokens: batchTokens,
          totalTokens: batchTokens,
          hasTokenUsage: true,
          metricsSource: "VENDOR",
          durationMs: 500,
          submittedAt,
          completedAt: submittedAt,
          inputSummary: {
            model: MODEL,
            inputCount: batch.length,
            reconciliationBackfill: true,
            chunkIds: batch.map((c) => c.id),
          },
          resultSummary: {
            reconciliationBackfill: true,
            source: "PlatformDocChunk",
            scale,
            usage: { prompt_tokens: batchTokens, total_tokens: batchTokens },
          },
        },
      });
    }
    created += 1;
  }

  console.log(
    `完成：${created} 批 · 约 ${(totalTokens / 1000).toFixed(3)} KTOKEN（scale=${scale}）`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
