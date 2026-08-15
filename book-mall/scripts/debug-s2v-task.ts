/* eslint-disable no-console */
/**
 * 直查一条 DashScope 异步任务的真实状态（排查 wan2.2-s2v 轮询超时）。
 *
 *   cd book-mall && pnpm tsx scripts/debug-s2v-task.ts <vendorTaskId> [bookUserEmail]
 */
import { resolveGatewayAuthForBookUser } from "../lib/gateway/book-gateway-link";
import { pollDashscopeTaskForLog } from "../lib/gateway/poll-service";
import { pickCredentialForKind } from "../lib/gateway/proxy-common";
import { prisma } from "../lib/prisma";

async function main() {
  const args = process.argv.slice(2).filter((a) => a.trim() && a !== "--");
  const taskId = args[0];
  const email = args[1] ?? "13808816802@126.com";
  if (!taskId) {
    console.error("用法：pnpm tsx scripts/debug-s2v-task.ts <vendorTaskId> [email]");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`未找到用户 ${email}`);

  const auth = await resolveGatewayAuthForBookUser(user.id);
  if (!auth) throw new Error("用户未关联 Gateway API Key");
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) throw new Error("无 DASHSCOPE 凭证");

  const log = await prisma.gatewayRequestLog.findFirst({
    where: { externalTaskId: taskId },
    select: {
      id: true,
      status: true,
      model: true,
      submittedAt: true,
      completedAt: true,
      failCode: true,
      failMessage: true,
    },
  });
  console.log("Gateway 日志：", JSON.stringify(log, null, 2));

  const polled = await pollDashscopeTaskForLog({ credentialId, taskId });
  console.log("厂商返回：", JSON.stringify(polled.output, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
