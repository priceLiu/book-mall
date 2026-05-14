/**
 * 当前库 → 写回 tool-web scheme A JSON（须已 bootstrap）。
 * cd book-mall && dotenv -e .env.local -- pnpm exec tsx scripts/pricing-emit-catalogs.ts
 */
import * as path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../lib/prisma";
import { emitToolWebSchemeACatalogs } from "../lib/pricing/emit-tool-web-catalogs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bookRoot = path.resolve(__dirname, "..");
const toolWebRoot = path.resolve(bookRoot, "..", "tool-web");

async function main() {
  const r = await emitToolWebSchemeACatalogs(prisma, toolWebRoot);
  console.log("Emitted:", r.visualPath, r.toolsPath);
  if (r.warnings.length) {
    console.warn("Warnings:", r.warnings);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
