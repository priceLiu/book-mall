/**
 * 自 tool-web/doc/price.md 合并导入 TOKEN 行（保留库内非 TOKEN 行）。
 * cd book-mall && dotenv -e .env.local -- pnpm exec tsx scripts/pricing-import-markdown.ts
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../lib/prisma";
import { parsePriceMdChinaMainlandTokenTables } from "../lib/pricing/price-md-china-parser";
import {
  createPricingVersionAndSetCurrent,
  loadCurrentPricingDrafts,
  mergeMarkdownTokenImport,
  tokenRowsToDraftRows,
} from "../lib/pricing/pricing-import-service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bookRoot = path.resolve(__dirname, "..");
const toolWebRoot = path.resolve(bookRoot, "..", "tool-web");

async function main() {
  const priceMdPath = path.join(toolWebRoot, "doc", "price.md");
  const md = fs.readFileSync(priceMdPath, "utf8");
  const extracted = parsePriceMdChinaMainlandTokenTables(md, {
    sourceRelativePath: "tool-web/doc/price.md",
  });
  const tokenDrafts = tokenRowsToDraftRows(extracted.rows);
  const prev = await loadCurrentPricingDrafts(prisma);
  if (prev.length === 0) {
    console.error("库中无价目。请先运行 pnpm pricing:bootstrap");
    process.exit(1);
  }
  const merged = mergeMarkdownTokenImport(tokenDrafts, prev);

  const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
    kind: "markdown",
    sourceSha256: extracted.meta.sourceSha256,
    label: "import tool-web/doc/price.md",
    parseWarnings: extracted.meta.warnings,
    lines: merged,
  });

  console.log(`Import markdown OK versionId=${versionId} rows=${merged.length}`);
  if (extracted.meta.warnings.length) console.warn("warnings:", extracted.meta.warnings);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
