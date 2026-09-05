/**
 * 按 CST 小时对齐：GatewayRequestLog / Canvas TEXT 任务 vs 厂商 canvas Key 用量。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/deepseek-forensics-hour.ts 2026-08-24 15
 */
import { prisma } from "../lib/prisma";

async function main() {
  const day = process.argv[2] ?? "2026-08-24";
  const hour = Number(process.argv[3] ?? "15");
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    throw new Error("hour must be 0-23");
  }

  const from = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+08:00`);
  const to = new Date(from.getTime() + 3600_000);

  console.log(`=== ${day} ${hour}:00–${hour + 1}:00 CST ===\n`);

  const textTasks = await prisma.canvasGenerationTask.findMany({
    where: { kind: "TEXT", createdAt: { gte: from, lt: to }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      projectId: true,
      status: true,
      model: true,
      createdAt: true,
      completedAt: true,
      failMessage: true,
      inputPayload: true,
    },
  });

  console.log(`Canvas TEXT tasks: ${textTasks.length}`);
  for (const t of textTasks) {
    const p = (t.inputPayload ?? {}) as Record<string, unknown>;
    const cst = new Date(t.createdAt.getTime() + 8 * 3600_000)
      .toISOString()
      .replace("T", " ")
      .slice(11, 19);
    console.log(
      `  ${cst} CST | ${t.status} | ${t.model} | provider=${p.providerId} | kind=${p.kind} | task=${t.id}`,
    );
    if (t.failMessage) console.log(`    fail: ${String(t.failMessage).slice(0, 120)}`);
  }

  const gw = await prisma.gatewayRequestLog.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      providerKind: true,
      model: true,
      status: true,
      clientPage: true,
      storyTaskId: true,
      promptTokens: true,
      completionTokens: true,
      credentialAliasSnapshot: true,
    },
  });

  console.log(`\nGatewayRequestLog (all providers): ${gw.length}`);
  for (const g of gw) {
    const cst = new Date(g.createdAt.getTime() + 8 * 3600_000)
      .toISOString()
      .replace("T", " ")
      .slice(11, 19);
    const tok = (g.promptTokens ?? 0) + (g.completionTokens ?? 0);
    console.log(
      `  ${cst} CST | ${g.providerKind} | ${g.model} | ${g.status} | tok=${tok} | ${g.clientPage}`,
    );
  }

  const deepseekGw = gw.filter((g) => g.providerKind === "DEEPSEEK");
  const gwTok = deepseekGw.reduce(
    (a, g) => a + (g.promptTokens ?? 0) + (g.completionTokens ?? 0),
    0,
  );
  console.log(`\nGateway DEEPSEEK: ${deepseekGw.length} calls, ~${gwTok} tokens`);
  console.log(
    "\nNote: canvas Key 直连不进 GatewayRequestLog；若厂商控制台该小时 ~1010 次而此处 DEEPSEEK 仅个位数，",
  );
  console.log("则 canvas Key 来自仓库外进程（如腾讯云 book-mall env DEEPSEEK_API_KEY=sk-918f 旧容器）。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
