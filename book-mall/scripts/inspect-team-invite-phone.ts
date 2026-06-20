/**
 * 排查团队邀请 / 成员状态（只读）
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/inspect-team-invite-phone.ts 13042023589
 */
import { prisma } from "../lib/prisma";

const phone = process.argv[2]?.trim() ?? "13042023589";
const adminPhone = process.argv[3]?.trim() ?? "13538662148";

async function main() {
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      phoneVerifiedAt: true,
      name: true,
      email: true,
      billingPersona: true,
    },
  });

  const admin = await prisma.user.findUnique({
    where: { phone: adminPhone },
    select: { id: true, phone: true, name: true },
  });

  const invites = await prisma.tenantInvite.findMany({
    where: { phone },
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { id: true, name: true, ownerUserId: true } } },
  });

  const memberships = user
    ? await prisma.tenantMember.findMany({
        where: { userId: user.id },
        include: {
          tenant: { select: { id: true, name: true, type: true, status: true } },
          seat: { select: { id: true, label: true, status: true } },
        },
      })
    : [];

  const adminTeams = admin
    ? await prisma.tenantMember.findMany({
        where: { userId: admin.id, role: { in: ["OWNER", "ADMIN"] } },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              seatLimit: true,
              status: true,
              ownerUserId: true,
            },
          },
        },
      })
    : [];

  console.log(JSON.stringify({ phone, user, admin, invites, memberships, adminTeams }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
