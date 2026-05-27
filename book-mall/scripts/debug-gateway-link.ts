import { prisma } from "../lib/prisma";
import { shouldCanvasUseGateway } from "../lib/canvas/canvas-gateway-run";
import {
  getGatewayLinkStatusForUser,
  resolveGatewayAuthForBookUser,
} from "../lib/canvas/book-gateway-link";

const email = "13808816802@126.com";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, gatewayApiKeyId: true, role: true },
  });
  if (!user) {
    console.log("user not found");
    return;
  }

  const link = await getGatewayLinkStatusForUser(user.id);
  const auth = await resolveGatewayAuthForBookUser(user.id);
  const useGw = await shouldCanvasUseGateway(
    user.id,
    "system:kie",
    "nano-banana-pro",
  );
  const gwUser = await prisma.gatewayUser.findFirst({
    where: { bookUserId: user.id },
  });
  const count = gwUser
    ? await prisma.gatewayRequestLog.count({ where: { userId: gwUser.id } })
    : 0;

  console.log(
    JSON.stringify(
      {
        link,
        useGw,
        auth: auth
          ? { id: auth.id, creds: auth.credentials.map((c) => c.providerKind) }
          : null,
        gatewayLogCount: count,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
