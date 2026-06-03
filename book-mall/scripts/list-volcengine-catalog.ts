/**
 * 打印 Gateway 目录中火山方舟模型条数（本地校验）
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/list-volcengine-catalog.ts
 */
import { buildGatewayModelCatalog } from "../lib/gateway/model-catalog";

function main() {
  const catalog = buildGatewayModelCatalog(["VOLCENGINE"]);
  const g = catalog.groups.find((x) => x.providerKind === "VOLCENGINE");
  if (!g) {
    console.error("无 VOLCENGINE 分组");
    process.exit(1);
  }
  console.log(`VOLCENGINE models (${g.models.length}):`);
  for (const m of g.models) {
    console.log(`  - ${m.displayName} [${m.modelKey}] ${m.requestKind}`);
  }
}

main();
