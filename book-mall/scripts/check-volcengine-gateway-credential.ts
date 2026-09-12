/**
 * 只读检查 canonical 平台池 VOLCENGINE 凭证（不输出完整 Key）
 */
import { getDecryptedCredentialApiKey } from "../lib/gateway/credential-service";
import { parseVolcengineGatewayCredential } from "../lib/gateway/volcengine-gateway-credential";
import { getCanonicalPlatformPoolOwnerEmail } from "../lib/gateway/platform-credential-copy";
import { prisma } from "../lib/prisma";
import { findGatewayUserByBookUserId } from "../lib/gateway/sync-user";

async function main() {
  const targetSuffix = process.argv[2]?.trim() || "";
  const email = getCanonicalPlatformPoolOwnerEmail();
  const bookUser = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true },
  });
  if (!bookUser) {
    console.error(`未找到 Book 用户: ${email}`);
    process.exit(1);
  }

  const gwUser = await findGatewayUserByBookUserId(bookUser.id);
  if (!gwUser) {
    console.error("未找到 Gateway 用户");
    process.exit(1);
  }

  const creds = await prisma.gatewayVendorCredential.findMany({
    where: { userId: gwUser.id, providerKind: "VOLCENGINE" },
    orderBy: [{ isDefaultForProvider: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      alias: true,
      active: true,
      isDefaultForProvider: true,
      channel: true,
      baseUrl: true,
    },
  });

  console.log(`owner=${bookUser.email} volcengine_count=${creds.length}`);
  for (const c of creds) {
    const dec = await getDecryptedCredentialApiKey(c.id);
    const parsed = parseVolcengineGatewayCredential(dec?.apiKey ?? "");
    const ark = parsed.arkApiKey;
    const masked = ark ? `${ark.slice(0, 12)}...${ark.slice(-5)}` : "(empty)";
    const matchTarget = targetSuffix ? ark.endsWith(targetSuffix) : false;
    console.log(
      JSON.stringify({ ...c, arkMasked: masked, matchTarget, hasPortraitIam: Boolean(parsed.portraitIam) }),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
