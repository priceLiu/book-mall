/**
 * BYOK 套餐对账修复：
 * 1. 将 ByokUsageMonthly.includedUsed 与 BYOK_QUOTA_INCLUDED 结算条数对齐
 * 2. --snapshots：按时间序重算每条结算行的 used/remaining 快照（修复 125→123 跳号）
 *
 *   pnpm billing:reconcile-byok-included-used                    # dry-run 聚合
 *   pnpm billing:reconcile-byok-included-used --apply            # 写库 聚合
 *   pnpm billing:reconcile-byok-included-used --snapshots        # dry-run 快照
 *   pnpm billing:reconcile-byok-included-used --snapshots --apply
 */
import {
  reconcileByokIncludedUsedFromSettlements,
  reconcileByokSettlementSnapshots,
} from "@/lib/finance/byok-quota-reconcile";

const apply = process.argv.includes("--apply");
const snapshots = process.argv.includes("--snapshots");

async function main() {
  if (snapshots) {
    const fixes = await reconcileByokSettlementSnapshots({ dryRun: !apply });
    if (!fixes.length) {
      console.log(
        apply ? "无需修复，结算快照已与流水顺序一致。" : "无需修复快照（dry-run）。",
      );
    } else {
      console.log(apply ? "已修复结算快照：" : "待修复结算快照（dry-run）：");
      for (const f of fixes) {
        console.log(
          `  ${f.ownerType}:${f.ownerId} ${f.byokTaskKind} ${f.periodKey} @ ${f.submittedAt.toISOString()}  used ${f.before.includedUsedAfter}→${f.after.includedUsedAfter}  remain ${f.before.includedRemainingAfter}→${f.after.includedRemainingAfter}`,
        );
      }
    }
    return;
  }

  const rows = await reconcileByokIncludedUsedFromSettlements({ dryRun: !apply });
  if (!rows.length) {
    console.log(apply ? "无需修复，includedUsed 已与结算流水一致。" : "无需修复（dry-run）。");
    return;
  }
  console.log(apply ? "已修复：" : "待修复（dry-run）：");
  for (const r of rows) {
    console.log(
      `  ${r.ownerType}:${r.ownerId} ${r.taskKind} ${r.periodKey}  ${r.beforeIncludedUsed} → ${r.afterIncludedUsed}（结算 ${r.settlementCount} 条）`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
