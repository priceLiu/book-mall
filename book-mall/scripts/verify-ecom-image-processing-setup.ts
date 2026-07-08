import { prisma } from "../lib/prisma";

const KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "doubao-seedream-5-0-lite",
];

async function main() {
  const migration = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE migration_name = '20260718120000_ecom_image_processing_credit_price'
  `;
  console.log("migration:", migration.length ? "applied" : "missing");

  const prices = await prisma.modelCreditPrice.findMany({
    where: { canonicalModelKey: { in: KEYS } },
    select: {
      canonicalModelKey: true,
      creditsPerUnit: true,
      active: true,
    },
  });
  console.log("creditPrices:", prices);

  const routes = await prisma.gatewayModelRoute.findMany({
    where: { canonicalModelKey: { in: KEYS } },
    select: { canonicalModelKey: true, modelKey: true, active: true },
  });
  console.log("routes:", routes);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
