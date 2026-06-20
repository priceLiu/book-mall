/**
 * 诊断用户 QuickReplica 准入
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/diagnose-quick-replica-user.ts 13042023589
 */
import { prisma } from "@/lib/prisma";
import { getMembershipToolAccess } from "@/lib/membership-tool-access";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import { issueToolsSsoRedirect } from "@/lib/issue-tools-sso-redirect";
import { assertGatewayApiKeyLinkedForUser } from "@/lib/gateway/book-gateway-link";
import { getQuickReplicaOrigin } from "@/lib/app-web-origins";

const phone = process.argv[2]?.trim() ?? "13042023589";

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone },
    select: {
      id: true,
      phone: true,
      billingPersona: true,
      gatewayApiKeyId: true,
    },
  });
  if (!user) {
    console.log("user not found");
    process.exit(1);
  }
  console.log("user", user);

  const member = await getMembershipToolAccess(user.id);
  console.log("memberAccess", member);

  const elig = await getToolsSsoEligibility(user.id);
  console.log("elig", {
    ok: elig.ok,
    hasActiveToolService: elig.hasActiveToolService,
    planName: elig.membershipPlanName,
  });

  try {
    await assertGatewayApiKeyLinkedForUser(user.id);
    console.log("gateway", "ok");
  } catch (e) {
    console.log("gateway", e instanceof Error ? e.message : e);
  }

  console.log("quickReplicaOrigin", getQuickReplicaOrigin());

  const sso = await issueToolsSsoRedirect({
    userId: user.id,
    redirectPath: "/",
    app: "quick-replica",
  });
  console.log(
    "sso",
    sso.ok ? { redirectUrl: sso.redirectUrl } : sso,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
