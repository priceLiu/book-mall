/** cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/inspect-user-billing-context.ts 13042023589 */
import { prisma } from "@/lib/prisma";
import { resolveTenantContextForUser } from "@/lib/tenant/context";
import { getPoolBalances } from "@/lib/billing/credit-account-service";

const phone = process.argv[2]?.trim() ?? "13042023589";

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone },
    select: {
      id: true,
      phone: true,
      primaryTenantId: true,
      billingPersona: true,
    },
  });
  if (!user) {
    console.log("user not found");
    process.exit(1);
  }

  const members = await prisma.tenantMember.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      tenant: { select: { id: true, name: true, type: true, planId: true } },
    },
  });

  const personalAcc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: user.id } },
  });

  const team = members.find((m) => m.tenant.type === "TEAM");
  const teamAcc = team
    ? await prisma.creditAccount.findUnique({
        where: {
          ownerType_ownerId: { ownerType: "TENANT", ownerId: team.tenant.id },
        },
      })
    : null;

  const ctxDefault = await resolveTenantContextForUser(user.id);
  const ctxTeam = team
    ? await resolveTenantContextForUser(user.id, team.tenant.id)
    : null;
  const poolsDefault = ctxDefault
    ? await getPoolBalances(ctxDefault.billingOwnerRef)
    : null;
  const poolsTeam = ctxTeam ? await getPoolBalances(ctxTeam.billingOwnerRef) : null;

  console.log({
    user,
    members: members.map((m) => ({
      role: m.role,
      tenantId: m.tenant.id,
      name: m.tenant.name,
      type: m.tenant.type,
    })),
    personalAcc: personalAcc
      ? {
          balance: personalAcc.balanceCredits,
          video: personalAcc.videoBalanceCredits,
        }
      : null,
    teamAcc: teamAcc
      ? {
          balance: teamAcc.balanceCredits,
          video: teamAcc.videoBalanceCredits,
        }
      : null,
    ctxDefault,
    ctxTeam,
    poolsDefault,
    poolsTeam,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
