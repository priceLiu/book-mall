/**
 * 一次性补偿：把 2026-05-18 之前 happyhorse-1.0-i2v 1080P 因 D 表 cost 错填 4.5（应 1.6）
 * 而被多扣的点数还给用户。
 *
 * 找出本次扫描得到的 ToolUsageEvent.id = cmpanmd1p000rr0i4ncqedb61：
 *   userId : cmp1b8wun0000r0zdar41scra（liu_price168@126.com）
 *   model  : happyhorse-1.0-i2v / 1080P / 5s / audio=true
 *   实扣   : 4500 点（¥45）
 *   应扣   : 1600 点（¥16，= 1.6 × 5 × 2 × 100）
 *   多扣   : 2900 点（¥29）
 *
 * 操作（事务）：
 *   1. Wallet.balancePoints += 2900
 *   2. WalletEntry type=ADJUST amountPoints=+2900 description=补偿说明
 *   3. ToolUsageEvent.costPoints = 1600（修正快照）
 *   4. ToolBillingDetailLine.cloudRow.adjustment 写入补偿凭证（不删原行）
 *
 * 用法：
 *   pnpm dotenv -e .env.local -- tsx scripts/refund-overcharge-2026-05-18.ts          # dry
 *   pnpm dotenv -e .env.local -- tsx scripts/refund-overcharge-2026-05-18.ts --apply  # 写库
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");

const TARGET_EVENT_ID = "cmpanmd1p000rr0i4ncqedb61";
const EXPECTED_CORRECT_POINTS = 1600; // 1.6 × 5 × 2 × 100
const ORIGINAL_CHARGED_POINTS = 4500;
const REFUND_POINTS = ORIGINAL_CHARGED_POINTS - EXPECTED_CORRECT_POINTS; // 2900
const IDEMPOTENCY_KEY = "refund_2026_05_18_happyhorse_1080p_overcharge_event_cmpanmd1p000rr0i4ncqedb61";

async function main() {
  console.log(`MODE: ${APPLY ? "APPLY (write to DB)" : "DRY-RUN (read-only)"}`);

  const event = await prisma.toolUsageEvent.findUnique({
    where: { id: TARGET_EVENT_ID },
    select: {
      id: true,
      userId: true,
      toolKey: true,
      action: true,
      meta: true,
      costPoints: true,
      billedVideoSec: true,
      walletHoldId: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });
  if (!event) {
    console.error(`未找到目标事件 ${TARGET_EVENT_ID}`);
    process.exit(1);
  }
  console.log("事件：", JSON.stringify(event, null, 2));
  if (event.costPoints !== ORIGINAL_CHARGED_POINTS) {
    console.warn(
      `⚠️ 事件 costPoints=${event.costPoints} 与预期 ${ORIGINAL_CHARGED_POINTS} 不一致。`,
    );
    console.warn("如果该事件已被纠正过，本脚本将被幂等键拦截，不会重复退款。");
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: event.userId },
    select: { id: true, balancePoints: true, frozenPoints: true },
  });
  if (!wallet) {
    console.error(`用户 ${event.userId} 没有钱包`);
    process.exit(1);
  }
  console.log("钱包当前：", wallet);

  const existed = await prisma.walletEntry.findUnique({
    where: { idempotencyKey: IDEMPOTENCY_KEY },
  });

  const lines = await prisma.toolBillingDetailLine.findMany({
    where: { toolUsageEventId: TARGET_EVENT_ID },
    select: { id: true, cloudRow: true },
  });
  console.log(`关联 ToolBillingDetailLine 行数：${lines.length}`);

  // 即使 walletEntry 已存在，也允许"二次进入"做 cloudRow 快照修正——
  // v1 的退款脚本只写了 cloudRow.adjustment 凭证，没有改"平台/扣点"等显示字段。
  // finance-web 直接读 cloudRow 展示，因此前端会一直看到旧值，这里要补做一次快照修正（幂等）。
  if (existed) {
    console.log(`✅ 已存在退款条目 entryId=${existed.id}（+${existed.amountPoints} 点）。继续检查 cloudRow 快照是否需补修。`);
    const stale = lines.filter((l) => {
      const cr = (l.cloudRow ?? {}) as Record<string, unknown>;
      const pts = parseInt(String(cr["平台/扣点"] ?? ""), 10);
      return !Number.isFinite(pts) || pts !== EXPECTED_CORRECT_POINTS;
    });
    if (stale.length === 0) {
      console.log("  cloudRow 快照已是修正后的值，无需再改。");
      return;
    }
    console.log(`  待修正快照行数：${stale.length}`);
    if (!APPLY) {
      console.log("\n（DRY-RUN）将把 cloudRow 内 平台/定价、平台/扣点、平台/应付金额、平台/计费公式 改成修正值。加 --apply 执行。");
      return;
    }
    await prisma.$transaction(async (tx) => {
      for (const l of stale) {
        const cr = (l.cloudRow ?? {}) as Record<string, unknown>;
        const before = {
          "平台/定价": cr["平台/定价"],
          "平台/扣点": cr["平台/扣点"],
          "平台/应付金额": cr["平台/应付金额"],
          "平台/计费公式": cr["平台/计费公式"],
        };
        const correctedYuan = EXPECTED_CORRECT_POINTS / 100;
        const newCloudRow = {
          ...cr,
          "平台/定价": "3.200000",
          "平台/扣点": String(EXPECTED_CORRECT_POINTS),
          "平台/应付金额": correctedYuan.toFixed(2),
          "平台/计费公式": "1.600000 元/秒 × 2 × 5 秒 = 3.200000 × 5 = ¥16.00",
          adjustment: {
            ...((cr["adjustment"] ?? {}) as object),
            snapshotPatchedAt: new Date().toISOString(),
            snapshotBefore: before,
          },
        };
        await tx.toolBillingDetailLine.update({
          where: { id: l.id },
          data: { cloudRow: newCloudRow as unknown as Prisma.InputJsonValue },
        });
        console.log(`  ToolBillingDetailLine ${l.id} cloudRow 快照已补修。`);
      }
    });
    console.log("\n✅ 快照补修完成。");
    return;
  }

  console.log("\n────────── 计划 ──────────");
  console.log(`补偿点数：+${REFUND_POINTS}（¥${(REFUND_POINTS / 100).toFixed(2)}）`);
  console.log(`Wallet.balancePoints: ${wallet.balancePoints} → ${wallet.balancePoints + REFUND_POINTS}`);
  console.log(`ToolUsageEvent.costPoints: ${event.costPoints} → ${EXPECTED_CORRECT_POINTS}`);
  console.log(`要写 WalletEntry idempotencyKey=${IDEMPOTENCY_KEY}`);
  console.log(`要在 ${lines.length} 条 ToolBillingDetailLine.cloudRow 上写 adjustment 凭证`);

  if (!APPLY) {
    console.log("\n（DRY-RUN）未写库。加 --apply 执行。");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const w = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePoints: { increment: REFUND_POINTS } },
      select: { balancePoints: true },
    });
    const entry = await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "ADJUST",
        amountPoints: REFUND_POINTS,
        balanceAfterPoints: w.balancePoints,
        idempotencyKey: IDEMPOTENCY_KEY,
        description:
          "价格基线对齐补偿（2026-05-18）：happyhorse-1.0-i2v 1080P 5s 因 D 表成本价错填多扣 ¥29，本次返还。详见 doc/releases/2026-05-18-pricing-baseline-realign-and-disclosure.md",
      },
    });
    console.log(`  WalletEntry created id=${entry.id} balanceAfter=${entry.balanceAfterPoints}`);

    await tx.toolUsageEvent.update({
      where: { id: TARGET_EVENT_ID },
      data: { costPoints: EXPECTED_CORRECT_POINTS },
    });
    console.log(`  ToolUsageEvent costPoints → ${EXPECTED_CORRECT_POINTS}`);

    for (const l of lines) {
      const cloudRow = (l.cloudRow ?? {}) as Record<string, unknown>;
      const before = {
        "平台/定价": cloudRow["平台/定价"],
        "平台/扣点": cloudRow["平台/扣点"],
        "平台/应付金额": cloudRow["平台/应付金额"],
        "平台/计费公式": cloudRow["平台/计费公式"],
      };
      const correctedYuan = EXPECTED_CORRECT_POINTS / 100; // 16
      // happyhorse-1.0-i2v · 1080P · audio：成本/秒 = ¥1.6，M = 2，billedSec = 5 → 1.6 × 2 × 5 × 100 = 1600
      const newCloudRow = {
        ...cloudRow,
        "平台/定价": "3.200000", // 云挂牌价 1.6 × M 2 = 3.2 元/秒
        "平台/扣点": String(EXPECTED_CORRECT_POINTS),
        "平台/应付金额": correctedYuan.toFixed(2),
        "平台/计费公式": "1.600000 元/秒 × 2 × 5 秒 = 3.200000 × 5 = ¥16.00",
        adjustment: {
          adjustedAt: new Date().toISOString(),
          reason: "pricing-baseline-realign-2026-05-18",
          originalChargePoints: ORIGINAL_CHARGED_POINTS,
          correctedChargePoints: EXPECTED_CORRECT_POINTS,
          refundedPoints: REFUND_POINTS,
          walletEntryId: entry.id,
          snapshotBefore: before,
        },
      };
      await tx.toolBillingDetailLine.update({
        where: { id: l.id },
        data: {
          cloudRow: newCloudRow as unknown as Prisma.InputJsonValue,
        },
      });
      console.log(`  ToolBillingDetailLine ${l.id} cloudRow 修正完毕（定价/扣点/应付/公式 → 修正值；原值搬至 adjustment.snapshotBefore）`);
    }
  });

  console.log("\n✅ 补偿完成。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
