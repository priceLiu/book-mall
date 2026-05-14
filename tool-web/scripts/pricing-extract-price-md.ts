/**
 * 从 `doc/price.md` 生成中国内地 Token 计价快照 JSON（上架溯源用）。
 * 用法：
 *   pnpm pricing:extract-price-md
 *   pnpm pricing:extract-price-md -- --lookup qwen3.6-plus
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parsePriceMdChinaMainlandTokenTables } from "../lib/pricing/price-md-china-parser";
import { lookupMainlandTokenFirstTier } from "../lib/pricing/price-md-china-lookup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const priceMd = path.join(root, "doc", "price.md");
const outDir = path.join(root, "config", "generated");
const outFile = path.join(outDir, "price-md-china-mainland-extract.json");

const md = fs.readFileSync(priceMd, "utf8");
const extract = parsePriceMdChinaMainlandTokenTables(md, {
  sourceRelativePath: "doc/price.md",
});

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(outFile, `${JSON.stringify(extract, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${extract.meta.rowCount} rows → ${path.relative(root, outFile)} (sha256=${extract.meta.sourceSha256.slice(0, 12)}…)`,
);
if (extract.meta.warnings.length) {
  console.warn("Warnings:", extract.meta.warnings.slice(0, 10));
}

const argv = process.argv.slice(2);
const li = argv.indexOf("--lookup");
if (li >= 0 && argv[li + 1]) {
  const q = argv[li + 1]!;
  const row = lookupMainlandTokenFirstTier(extract.rows, q);
  if (!row) {
    console.error(`No match for: ${q}`);
    process.exit(1);
  }
  const M = 2;
  const cost = 0.35 * row.inputYuanPerMillion + 0.57 * row.outputYuanPerMillion;
  const retail = cost * M;
  const pts = Math.max(1, Math.round(retail * 100));
  console.log(
    "\n--lookup sample (分析室默认等价 0.35M 入 / 0.57M 出 + M=2 演示，上架工作单请按实际工具改写 eqIn/eqOut):",
  );
  console.log(JSON.stringify({ row, costYuanDemo: cost, retailYuanDemo: retail, pointsDemo: pts }, null, 2));
}
