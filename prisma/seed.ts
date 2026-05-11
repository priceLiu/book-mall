import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.platformConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: "monthly" },
    create: {
      slug: "monthly",
      name: "月度订阅",
      interval: "MONTH",
      priceMinor: 2990,
      active: true,
    },
    update: { name: "月度订阅", priceMinor: 2990, active: true },
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: "yearly" },
    create: {
      slug: "yearly",
      name: "年度订阅",
      interval: "YEAR",
      priceMinor: 29900,
      active: true,
    },
    update: { name: "年度订阅", priceMinor: 29900, active: true },
  });

  const adminEmails =
    process.env.ADMIN_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? [];
  for (const email of adminEmails) {
    const r = await prisma.user.updateMany({
      where: { email },
      data: { role: "ADMIN" },
    });
    if (r.count > 0) console.log(`已设为管理员: ${email}`);
  }

  await prisma.productCategory.upsert({
    where: { slug: "ai-courses" },
    create: {
      name: "AI 课程",
      slug: "ai-courses",
      kind: "KNOWLEDGE",
      sortOrder: 0,
    },
    update: { name: "AI 课程", kind: "KNOWLEDGE", sortOrder: 0 },
  });
  await prisma.productCategory.upsert({
    where: { slug: "ai-apps" },
    create: {
      name: "AI 应用",
      slug: "ai-apps",
      kind: "TOOL",
      sortOrder: 0,
    },
    update: { name: "AI 应用", kind: "TOOL", sortOrder: 0 },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
