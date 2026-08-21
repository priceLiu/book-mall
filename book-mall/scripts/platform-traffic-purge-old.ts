/**
 * 删除 90 天前的 SiteTrafficIpDaily 明细（日汇总保留）。
 * 用法：pnpm --dir book-mall tsx scripts/platform-traffic-purge-old.ts
 */
import { prisma } from "../lib/prisma";
import { cstDateKey } from "../lib/site-traffic/cst-date";

const RETAIN_DAYS = 90;

async function main() {
  const cutoff = new Date(Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000);
  const dateCst = cstDateKey(cutoff);
  const result = await prisma.siteTrafficIpDaily.deleteMany({
    where: { dateCst: { lt: dateCst } },
  });
  console.log(`[platform-traffic-purge] deleted ${result.count} rows before ${dateCst}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
