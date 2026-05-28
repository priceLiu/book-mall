import { prisma } from "../lib/prisma";
import { getGatewayLinkStatusForUser } from "../lib/gateway/book-gateway-link";
import { navKeysFromActiveToolServicePeriods } from "../lib/tool-service-fee/periods";
import { assertPlatformGatewayEntitlement } from "../lib/platform-gateway-entitlement";
import { userHasAnyActiveToolService } from "../lib/tool-service-fee/periods";

const email = process.argv[2] ?? "13808816802@126.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, gatewayApiKeyId: true, email: true },
  });
  if (!user) {
    console.log(JSON.stringify({ error: "user_not_found", email }, null, 2));
    return;
  }
  const link = await getGatewayLinkStatusForUser(user.id);
  const navKeys = await navKeysFromActiveToolServicePeriods(user.id);
  const hasService = await userHasAnyActiveToolService(user.id);
  let entitlement: { ok: boolean; message?: string } = { ok: true };
  try {
    await assertPlatformGatewayEntitlement(user.id, { navKey: "visual-lab" });
  } catch (e) {
    entitlement = { ok: false, message: (e as Error).message };
  }
  console.log(
    JSON.stringify(
      {
        user,
        gateway: link,
        hasActiveToolService: hasService,
        navKeys,
        visualLabEntitlement: entitlement,
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
  .finally(() => prisma.$disconnect());
