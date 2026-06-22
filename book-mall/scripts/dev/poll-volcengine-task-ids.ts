/**
 * 按 Vendor Task ID 前缀查 Gateway 日志并 poll 火山现网状态。
 * 用法：pnpm exec tsx scripts/dev/poll-volcengine-task-ids.ts [prefix...]
 */
import { PrismaClient } from "@prisma/client";

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import { volcengineGetVideoTask } from "@/lib/gateway/volcengine-client";

const prisma = new PrismaClient();

const DEFAULT_PREFIXES = [
  "02178210806485",
  "02178210772865",
  "02178210693574",
];

async function pollTask(taskId: string, credentialId: string) {
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    console.log("  vendor: 凭证不可用");
    return;
  }
  const polled = await volcengineGetVideoTask({
    apiKey: resolveVolcengineArkApiKey(cred.apiKey),
    baseUrl: cred.baseUrl,
    taskId,
  });
  const out = polled.output;
  console.log(`  vendor status: ${out.status}`);
  if (out.error) console.log(`  vendor error: ${JSON.stringify(out.error)}`);
  if (out.content?.video_url) {
    console.log(`  video_url: ${out.content.video_url}`);
  }
  if (out.content?.last_frame_url) {
    console.log(`  last_frame_url: ${out.content.last_frame_url}`);
  }
}

async function main() {
  const prefixes = process.argv.slice(2).length
    ? process.argv.slice(2)
    : DEFAULT_PREFIXES;

  for (const prefix of prefixes) {
    const rows = await prisma.gatewayRequestLog.findMany({
      where: {
        externalTaskId: { startsWith: prefix },
      },
      orderBy: { submittedAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        failCode: true,
        failMessage: true,
        externalTaskId: true,
        credentialId: true,
        submittedAt: true,
        completedAt: true,
        lastPolledAt: true,
        model: true,
        canonicalModelKey: true,
      },
    });

    console.log(`\n=== prefix ${prefix} (${rows.length} log(s)) ===`);
    if (rows.length === 0) {
      console.log("  (DB 无匹配)");
      continue;
    }

    for (const row of rows) {
      const taskId = row.externalTaskId!.trim();
      console.log("---");
      console.log(`  logId: ${row.id}`);
      console.log(`  gateway: status=${row.status} failCode=${row.failCode ?? "—"}`);
      console.log(`  model: ${row.canonicalModelKey ?? row.model}`);
      console.log(`  vendorTaskId: ${taskId}`);
      console.log(
        `  submitted: ${row.submittedAt.toISOString()} completed: ${row.completedAt?.toISOString() ?? "—"}`,
      );
      console.log(`  failMessage: ${(row.failMessage ?? "").slice(0, 120)}…`);

      if (!row.credentialId) {
        console.log("  vendor: 无 credentialId");
        continue;
      }
      try {
        await pollTask(taskId, row.credentialId);
      } catch (e) {
        console.log(
          `  vendor poll error: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
