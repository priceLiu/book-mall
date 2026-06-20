/**
 * 补救团队成员计费上下文：默认空间切到团队 + 画布项目归属团队。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/repair-team-member-billing.ts 13042023589
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/repair-team-member-billing.ts 13042023589 --dry-run
 */
import { normalizePhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/prisma";

const dryRun = process.argv.includes("--dry-run");
const phoneArg = process.argv.find((a) => /^\d{11}$/.test(a)) ?? "13042023589";

async function main() {
  const phone = normalizePhone(phoneArg);
  if (!phone) throw new Error(`无效手机号: ${phoneArg}`);

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, phone: true, primaryTenantId: true },
  });
  if (!user) throw new Error(`用户不存在: ${phone}`);

  const teamMember = await prisma.tenantMember.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      role: "MEMBER",
      tenant: { type: "TEAM", status: "ACTIVE", planId: { not: null } },
    },
    include: { tenant: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });
  if (!teamMember) {
    throw new Error(`用户 ${phone} 无有效团队成员身份，无法修复`);
  }

  const teamId = teamMember.tenant.id;
  const projects = await prisma.canvasProject.findMany({
    where: { userId: user.id, OR: [{ tenantId: null }, { tenantId: { not: teamId } }] },
    select: { id: true, name: true, tenantId: true },
  });

  console.log({
    phone,
    userId: user.id,
    primaryTenantIdBefore: user.primaryTenantId,
    teamId,
    teamName: teamMember.tenant.name,
    canvasProjectsToFix: projects,
  });

  if (dryRun) {
    console.log("[dry-run] 将设置 primaryTenantId → 团队，并更新画布项目 tenantId");
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { primaryTenantId: teamId },
  });

  if (projects.length > 0) {
    await prisma.canvasProject.updateMany({
      where: { id: { in: projects.map((p) => p.id) } },
      data: { tenantId: teamId },
    });
  }

  console.log("[ok] 已修复。请让用户关闭画布标签页，从个人中心重新打开 AI 画布（刷新 SSO 令牌）。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
