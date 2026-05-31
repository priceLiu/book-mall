/**
 * 诊断 Gateway 凭证 Test Connection 失败原因
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/debug-gateway-credential-test.ts
 */
import { decryptApiKey } from "../lib/canvas/secret";
import { testGatewayCredentialConnection } from "../lib/gateway/gateway-credential-test";
import { findGatewayUserByBookUserId } from "../lib/gateway/sync-user";
import { prisma } from "../lib/prisma";

const PILOT_EMAIL = "13808816802@126.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: PILOT_EMAIL.trim().toLowerCase() },
  });
  if (!user) {
    console.error("user not found");
    process.exit(1);
  }
  const gwUser = await findGatewayUserByBookUserId(user.id);
  if (!gwUser) {
    console.error("gateway user not found");
    process.exit(1);
  }

  const creds = await prisma.gatewayVendorCredential.findMany({
    where: { userId: gwUser.id },
    orderBy: { providerKind: "asc" },
  });

  for (const c of creds) {
    const key = decryptApiKey(c.apiKeyEncrypted);
    console.log("\n---", c.alias, c.providerKind);
    console.log("baseUrl:", c.baseUrl);
    console.log("active:", c.active);
    console.log("key prefix:", key.slice(0, 12) + "…");
    const r = await testGatewayCredentialConnection(c);
    console.log("testConnection:", r);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
