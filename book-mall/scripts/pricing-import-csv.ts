/**
 * 规范 CSV → 与库合并（同 fingerprint 覆盖）并生成新版本。
 * cd book-mall && dotenv -e .env.local -- pnpm exec tsx scripts/pricing-import-csv.ts /path/to.csv
 */
import * as fs from "fs";
import { prisma } from "../lib/prisma";
import { parseCanonicalPricingCsv } from "../lib/pricing/canonical-csv";
import {
  createPricingVersionAndSetCurrent,
  loadCurrentPricingDrafts,
  mergeCsvImportIntoCurrent,
} from "../lib/pricing/pricing-import-service";

async function main() {
  const p = process.argv[2];
  if (!p) {
    console.error("用法: pricing-import-csv.ts <file.csv>");
    process.exit(1);
  }
  const text = fs.readFileSync(p, "utf8");
  const parsed = parseCanonicalPricingCsv(text);
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(1);
  }
  const prev = await loadCurrentPricingDrafts(prisma);
  if (prev.length === 0) {
    console.error("库中无价目。请先 bootstrap");
    process.exit(1);
  }
  const merged = mergeCsvImportIntoCurrent(prev, parsed.rows);
  const buf = Buffer.from(text, "utf8");
  const { createHash } = await import("crypto");
  const sha = createHash("sha256").update(buf).digest("hex");

  const { versionId } = await createPricingVersionAndSetCurrent(prisma, {
    kind: "csv",
    sourceSha256: sha,
    label: `csv:${p}`,
    lines: merged,
  });
  console.log(`Import csv OK versionId=${versionId} merged=${merged.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
