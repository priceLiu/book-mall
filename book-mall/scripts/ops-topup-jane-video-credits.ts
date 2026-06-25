/**
 * 运维：给 jane 团队充值「视频专项积分」（VIDEO 池 · TOPUP，不随月度重置过期）。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/ops-topup-jane-video-credits.ts            # DRY-RUN 预览
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/ops-topup-jane-video-credits.ts --confirm  # 真正写入
 *
 * - 走统一计费正规函数 topupCredits（pool=VIDEO，type=TOPUP），自动落流水 + 更新余额。
 * - 幂等键保证重复执行不重复充值。
 */
import { prisma } from "../lib/prisma";
import { ensureCreditAccount, topupCredits } from "../lib/billing/credit-account-service";

/** jane 团队租户（见 scripts/migrate-user-billing-to-jane-team.ts）。 */
const JANE_TENANT_ID = "cmqjtfu3d006lr0je53p8mwzj";
const VIDEO_CREDITS = 99000;
const IDEMPOTENCY_KEY = "ops_topup:jane-team:2026-06-25:video-99000";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const confirm = hasFlag("confirm");

  const tenant = await prisma.tenant.findUnique({
    where: { id: JANE_TENANT_ID },
    select: { id: true, name: true, type: true, status: true, currentPeriodEnd: true },
  });
  if (!tenant) throw new Error(`未找到 jane 团队租户 ${JANE_TENANT_ID}`);

  const account = await ensureCreditAccount({ ownerType: "TENANT", ownerId: tenant.id });

  console.log(`[topup-jane] ${confirm ? "执行" : "DRY-RUN"} · 团队=${tenant.name}（${tenant.id}）`);
  console.log(`[topup-jane] 租户: type=${tenant.type} status=${tenant.status} 订阅末=${tenant.currentPeriodEnd?.toISOString() ?? "—"}`);
  console.log(`[topup-jane] 充值前: 视频余额=${account.videoBalanceCredits} 视频冻结=${account.videoReservedCredits} 通用余额=${account.balanceCredits}`);
  console.log(`[topup-jane] 计划: VIDEO 池 +${VIDEO_CREDITS}（TOPUP，幂等键 ${IDEMPOTENCY_KEY}）`);

  if (!confirm) {
    console.log("[topup-jane] 预览完成。加 --confirm 执行写入。");
    return;
  }

  const res = await topupCredits({
    ref: { ownerType: "TENANT", ownerId: tenant.id },
    credits: VIDEO_CREDITS,
    pool: "VIDEO",
    refType: "ops_topup",
    idempotencyKey: IDEMPOTENCY_KEY,
    description: `运维充值·视频专项积分（jane 团队 +${VIDEO_CREDITS}）`,
  });

  const after = await prisma.creditAccount.findUniqueOrThrow({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: tenant.id } },
    select: { videoBalanceCredits: true, videoReservedCredits: true, balanceCredits: true },
  });

  console.log(
    `[topup-jane] 完成: ${res.deduped ? "[幂等跳过·未重复充值]" : "已充值"} 视频余额=${after.videoBalanceCredits} 视频冻结=${after.videoReservedCredits}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
