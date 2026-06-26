/**
 * 按 Vendor Task ID（火山 cgt-…）向厂商复核并收口对应 Gateway 日志，并同步回画布。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/recover-gateway-logs-by-vendor-task.ts [vendorTaskId...]
 *
 * 无参数时复核下方 DEFAULT_VENDOR_TASK_IDS。
 * 复核走 recoverVolcengineGatewayLogFromVendor：厂商已出片 → SUCCEEDED 收口 + 同步画布节点。
 */
import { prisma } from "../lib/prisma";
import { recoverVolcengineGatewayLogFromVendor } from "../lib/gateway/volcengine-stall-recover";

const DEFAULT_VENDOR_TASK_IDS = [
  "cgt-20260626013245-gt64g",
  "cgt-20260626012019-n887q",
  "cgt-20260625225914-8d2zj",
];

async function main() {
  const args = process.argv.slice(2);
  const vendorTaskIds = args.length > 0 ? args : DEFAULT_VENDOR_TASK_IDS;

  for (const externalTaskId of vendorTaskIds) {
    const log = await prisma.gatewayRequestLog.findFirst({
      where: { externalTaskId },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        status: true,
        failCode: true,
        providerKind: true,
        requestKind: true,
        submittedAt: true,
      },
    });
    if (!log) {
      console.log(`[recover] vendorTask=${externalTaskId} -> gateway_log_not_found`);
      continue;
    }
    console.log(
      `[recover] vendorTask=${externalTaskId} logId=${log.id} before status=${log.status} failCode=${log.failCode ?? "-"}`,
    );
    const result = await recoverVolcengineGatewayLogFromVendor(log.id);
    console.log(`[recover]   -> action=${result.action} ok=${result.ok} msg=${result.message}` + (result.videoUrl ? ` videoUrl=${result.videoUrl}` : ""));

    const after = await prisma.gatewayRequestLog.findUnique({
      where: { id: log.id },
      select: { status: true, failCode: true },
    });
    console.log(`[recover]   after status=${after?.status} failCode=${after?.failCode ?? "-"}`);
  }
}

main()
  .catch((e) => {
    console.error("[recover-gateway-logs-by-vendor-task] error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
