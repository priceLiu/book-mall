/**
 * 一次性诊断：平台池与用户 Gateway Key 是否绑定 ELEVENLABS 凭证。
 * 用法：pnpm --dir book-mall exec dotenv -e .env.local -- tsx scripts/check-elevenlabs-gateway-credential.ts
 */
import { prisma } from "@/lib/prisma";
import { getCanonicalPlatformPoolOwnerEmail } from "@/lib/gateway/platform-credential-copy";
import { getPlatformCredentialPoolStatus } from "@/lib/gateway/platform-credential-pool";

async function main() {
  const pool = await getPlatformCredentialPoolStatus();
  const elevenInPool = pool.credentials.filter((c) => c.providerKind === "ELEVENLABS");

  const allEleven = await prisma.gatewayVendorCredential.findMany({
    where: { providerKind: "ELEVENLABS" },
    select: {
      id: true,
      alias: true,
      channel: true,
      ownerScope: true,
      active: true,
    },
  });

  const usersWithGw = await prisma.user.findMany({
    where: { gatewayApiKeyId: { not: null } },
    select: {
      id: true,
      email: true,
      gatewayApiKeyId: true,
      billingPersona: true,
    },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

  const bindingReport = [];
  for (const u of usersWithGw) {
    if (!u.gatewayApiKeyId) continue;
    const key = await prisma.gatewayApiKey.findUnique({
      where: { id: u.gatewayApiKeyId },
      select: {
        scope: true,
        bindings: {
          include: {
            credential: {
              select: { providerKind: true, alias: true, active: true },
            },
          },
        },
      },
    });
    bindingReport.push({
      email: u.email,
      billingPersona: u.billingPersona,
      keyScope: key?.scope ?? null,
      providers: [...new Set(key?.bindings.map((b) => b.credential.providerKind) ?? [])].sort(),
      hasElevenLabs: key?.bindings.some(
        (b) => b.credential.providerKind === "ELEVENLABS" && b.credential.active,
      ) ?? false,
    });
  }

  const noKey = await prisma.user.count({ where: { gatewayApiKeyId: null } });
  const withKey = await prisma.user.count({ where: { gatewayApiKeyId: { not: null } } });
  const recentLogs = await prisma.gatewayRequestLog.findMany({
    where: { providerKind: "ELEVENLABS" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      status: true,
      endpoint: true,
      failMessage: true,
      createdAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        canonicalOwner: getCanonicalPlatformPoolOwnerEmail(),
        poolSource: pool.source,
        platformKeyId: pool.platformKeyId,
        platformKeyName: pool.platformKeyName,
        elevenInPlatformPool: elevenInPool,
        allElevenCredentialsCount: allEleven.length,
        usersWithGatewayKey: bindingReport,
        usersWithoutGatewayKey: noKey,
        usersWithGatewayKeyCount: withKey,
        recentElevenLogs: recentLogs,
        conclusion:
          elevenInPool.length > 0
            ? "platform_pool_has_elevenlabs"
            : allEleven.length > 0
              ? "elevenlabs_exists_but_not_in_platform_pool"
              : "no_elevenlabs_credential_in_db",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
