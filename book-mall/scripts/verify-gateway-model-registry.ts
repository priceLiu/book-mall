/**
 * 校验 Gateway 统一注册表完整性。
 *
 *   pnpm tsx scripts/verify-gateway-model-registry.ts
 */
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";
import { prisma } from "../lib/prisma";

async function main() {
  let errors = 0;

  for (const def of GATEWAY_CANONICAL_REGISTRY) {
    const cat = await prisma.modelCatalog.findUnique({
      where: { canonicalKey: def.canonicalModelKey },
    });
    if (!cat?.gatewayPublished) {
      console.error(`缺少或未发布 ModelCatalog: ${def.canonicalModelKey}`);
      errors++;
      continue;
    }

    const routes = await prisma.gatewayModelRoute.findMany({
      where: { canonicalModelKey: def.canonicalModelKey, active: true },
    });
    if (routes.length === 0) {
      console.error(`无 GatewayModelRoute: ${def.canonicalModelKey}`);
      errors++;
    }

    for (const r of def.routes) {
      if (!routes.some((x) => x.modelKey === r.modelKey && x.vendor === r.vendor)) {
        console.error(`缺少路由 ${def.canonicalModelKey} / ${r.vendor} / ${r.modelKey}`);
        errors++;
      }
    }
  }

  const offeringCount = await prisma.appModelOffering.count({
    where: { status: "ACTIVE" },
  });

  console.log(`ACTIVE offerings: ${offeringCount}`);
  if (errors > 0) {
    console.error(`校验失败：${errors} 项`);
    process.exit(1);
  }
  console.log("Gateway 注册表校验通过。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
