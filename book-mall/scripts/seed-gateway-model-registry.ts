/**
 * 导入 Gateway 统一模型注册表（ModelCatalog + GatewayModelRoute + PlatformMediaDefault）。
 *
 *   pnpm tsx scripts/seed-gateway-model-registry.ts --confirm
 */
import { GATEWAY_CANONICAL_REGISTRY } from "../lib/platform-model/canonical-registry";
import { syncGatewayCanonicalRegistryToDb } from "../lib/gateway/sync-canonical-registry";
import { prisma } from "../lib/prisma";

async function main() {
  const confirm = process.argv.includes("--confirm");
  if (!confirm) {
    console.log(`将写入 ${GATEWAY_CANONICAL_REGISTRY.length} 个 canonical 模型。请加 --confirm 执行。`);
    return;
  }

  const { canonicalCount, mediaDefaultCount } = await syncGatewayCanonicalRegistryToDb();
  console.log(`已 seed ${canonicalCount} 个 canonical 与 ${mediaDefaultCount} 个媒介默认槽。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
