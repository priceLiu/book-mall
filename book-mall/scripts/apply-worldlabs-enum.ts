/* eslint-disable no-console */
/** 单独应用 WORLDLABS enum（migrate deploy 不可用时备用） */
import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "GatewayProviderKind" ADD VALUE IF NOT EXISTS 'WORLDLABS'`,
  );
  console.log("[apply-worldlabs-enum] ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
