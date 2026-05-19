/**
 * 验收：把已修正的 happyhorse 那条 ToolBillingDetailLine 走一遍 enrich+overlay，
 * 确认前端表格里看到的将是修正后的值。
 */
import { enrichBillingLineToFlatRow } from "../lib/finance/cloud-bill-enrich";
import { applyCanonicalOverlayBatch } from "../lib/finance/canonical-bill-overlay";
import { prisma } from "../lib/prisma";

async function main() {
  const line = await prisma.toolBillingDetailLine.findUnique({
    where: { id: "cmpanmd8s000vr0i43qle90fp" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!line) throw new Error("line not found");
  const baseRow = enrichBillingLineToFlatRow(
    line,
    line.user.id,
    line.user.name ?? line.user.email ?? "",
  );
  const [row] = await applyCanonicalOverlayBatch([baseRow]);
  if (!row) throw new Error("row missing after overlay");
  const cols = ["平台/产品名称", "平台/计费项Code", "平台/系数(M)", "平台/定价", "平台/扣点", "平台/计费公式", "平台/应付金额"];
  for (const k of cols) console.log(`  ${k.padEnd(20)} = ${JSON.stringify(row[k])}`);

  const ok =
    row["平台/扣点"] === "1600" &&
    row["平台/应付金额"] === "16.00" &&
    row["平台/定价"] === "3.200000" &&
    (row["平台/计费公式"] ?? "").includes("¥16.00");
  console.log(ok ? "\n✅ enrich+overlay 后展示值已是修正后的值。" : "\n❌ 仍然不对");
  if (!ok) process.exitCode = 2;
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
