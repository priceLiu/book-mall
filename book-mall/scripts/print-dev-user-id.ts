/**
 * 打印一个可用于 FINANCE_DEV_USER_ID / NEXT_PUBLIC_FINANCE_DEV_USER_ID 的 User.id（本地开发）。
 *
 * dotenv -e .env.local -- tsx scripts/print-dev-user-id.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const u = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!u) {
    console.error("库中暂无用户，请先注册或 seed");
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        id: u.id,
        email: u.email,
        name: u.name,
        hint: "在 finance-web .env.local 设置 FINANCE_DEV_USER_ID 与可选 NEXT_PUBLIC_FINANCE_DEV_USER_ID 为上述 id；book-mall 设置 FINANCE_ALLOW_DEV_USER_QUERY=1；finance-web 开启 NEXT_PUBLIC_FINANCE_USE_DEV_PROXY=1",
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
