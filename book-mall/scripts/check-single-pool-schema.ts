import { prisma } from "../lib/prisma";

async function main() {
  const videoCols = await prisma.$queryRawUnsafe<
    { column_name: string }[]
  >(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'CreditAccount' AND column_name LIKE 'video%'`,
  );
  const poolEnum = await prisma.$queryRawUnsafe<{ typname: string }[]>(
    `SELECT typname FROM pg_type WHERE typname = 'CreditPool'`,
  );
  const ledgerPool = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'CreditLedger' AND column_name = 'pool'`,
  );
  console.log("CreditAccount video cols:", videoCols.map((c) => c.column_name));
  console.log("CreditPool enum exists:", poolEnum.length > 0);
  console.log("CreditLedger.pool exists:", ledgerPool.length > 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
