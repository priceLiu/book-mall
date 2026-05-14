/**
 * 上传价目表列名不一致时，转为规范 CSV。
 * npx tsx scripts/pricing-normalize-upload-csv.ts in.csv [out.csv]
 */
import * as fs from "fs";
import { rewriteCsvToCanonicalOrder } from "../lib/pricing/canonical-csv";

const input = process.argv[2];
const output = process.argv[3] ?? input.replace(/\.csv$/i, ".canonical.csv");
if (!input) {
  console.error("用法: pricing-normalize-upload-csv.ts in.csv [out.csv]");
  process.exit(1);
}
const text = fs.readFileSync(input, "utf8");
const r = rewriteCsvToCanonicalOrder(text);
if (!r.ok) {
  console.error(r.error);
  process.exit(1);
}
fs.writeFileSync(output, r.out, "utf8");
console.log("Wrote", output);
