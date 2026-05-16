/**
 * v002 P5（统一）：从 CLI 上传 CSV 并执行对账（复用与 `/admin/finance/reconciliation` 完全一致的 lib）。
 *
 * 用法：
 *   pnpm reconciliation:run -- --csv=./tool-web/doc/*.csv [--admin-user-id=cmp...] [--force]
 *
 * 行为：
 *   - 与 UI 一致：解析 CSV → CloudAccountBinding 映射 → 写 ToolBillingDetailLine(CLOUD_CSV_IMPORT) →
 *     算对账 → 写 BillingReconciliationRun + Lines。
 *   - admin-user-id 默认取环境变量 `BILLING_RECON_ADMIN_USER_ID`；不传则用第一个 ADMIN 用户。
 *   - 同 SHA-256 已上传 → 默认复用旧 run；`--force` 时报错。
 *
 * 旧脚本 `reconcile-against-cloud-csv`/`billing-deficit-claw-back`/`billing-import-cloud-csv` 已删除；
 * 补扣请走管理端 UI 二次确认或直接发 POST 到 `/api/admin/finance/reconciliation/[runId]/clawback`。
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { runReconciliationFromCsv } from "../lib/finance/reconciliation-run";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

async function resolveAdminUserId(): Promise<string> {
  const fromFlag = parseArg("admin-user-id") || process.env.BILLING_RECON_ADMIN_USER_ID;
  if (fromFlag) return fromFlag.trim();
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("数据库中没有 ADMIN 用户；请通过 --admin-user-id=... 显式指定");
  }
  return admin.id;
}

async function main() {
  const csvPath = parseArg("csv");
  if (!csvPath) {
    console.error("用法：pnpm reconciliation:run -- --csv=./path/to/file.csv [--admin-user-id=...] [--force]");
    process.exit(2);
  }
  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`CSV 不存在：${abs}`);
    process.exit(2);
  }
  const text = fs.readFileSync(abs, "utf-8");
  const force = process.argv.includes("--force");
  const adminUserId = await resolveAdminUserId();

  console.log(`[recon-cli] csv=${abs} admin=${adminUserId} force=${force}`);
  const result = await runReconciliationFromCsv({
    csvText: text,
    csvFilename: path.basename(abs),
    importedByUserId: adminUserId,
    rejectDuplicate: force,
  });

  console.log("\n=== 对账批次 ===");
  console.log(`runId=${result.runId}`);
  console.log(JSON.stringify(result.summary, null, 2));

  console.log("\n=== 报告行（前 20）===");
  for (const l of result.lines.slice(0, 20)) {
    const tag = l.diffYuan < 0 ? "❗" : "✅";
    console.log(
      `${tag} user=${l.userId ?? "(unbound)"} model=${l.modelKey} kind=${l.billingKind} ` +
        `内=${l.internalYuan} 云=${l.cloudPayableYuan} 差=${l.diffYuan} match=${l.matchKind}`,
    );
  }
  if (result.lines.length > 20) {
    console.log(`... (+${result.lines.length - 20} 行省略, 详情见 /admin/finance/reconciliation)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
