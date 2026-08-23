import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.gatewayRequestLog.findMany({
    where: { failCode: "STALE_CHAT_ORPHAN", requestKind: "CHAT" },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      model: true,
      clientPage: true,
      submittedAt: true,
      completedAt: true,
      durationMs: true,
      status: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      hasTokenUsage: true,
      metricsSource: true,
      estimatedVendorCostYuan: true,
      creditsCharged: true,
      billingMode: true,
      failMessage: true,
      vendorRequestId: true,
      inputSummary: true,
      resultSummary: true,
    },
  });

  let withTokens = 0;
  let withVendorCost = 0;
  let withCredits = 0;
  let totalTokensSum = 0;
  let totalVendorYuan = 0;
  let totalCredits = 0;

  console.log("=== STALE_CHAT_ORPHAN billing summary ===");
  console.log("count:", rows.length);

  for (const r of rows) {
    const tokens = r.totalTokens ?? 0;
    const vendor = r.estimatedVendorCostYuan
      ? Number(r.estimatedVendorCostYuan)
      : 0;
    const credits = r.creditsCharged ?? 0;
    if (tokens > 0 || r.hasTokenUsage) withTokens++;
    if (vendor > 0) withVendorCost++;
    if (credits > 0) withCredits++;
    totalTokensSum += tokens;
    totalVendorYuan += vendor;
    totalCredits += credits;
  }

  console.log({
    withTokenUsage: withTokens,
    withEstimatedVendorCostYuan: withVendorCost,
    withCreditsCharged: withCredits,
    totalTokensSum,
    totalVendorYuan: totalVendorYuan.toFixed(6),
    totalCreditsCharged: totalCredits,
  });

  // Credit ledger tied to these log ids
  const logIds = rows.map((r) => r.id);
  const ledger = await prisma.creditLedger.findMany({
    where: {
      idempotencyKey: {
        in: logIds.flatMap((id) => [
          `gateway_log:${id}`,
          `settle:${id}`,
          `refund:${id}`,
        ]),
      },
    },
    select: {
      type: true,
      credits: true,
      idempotencyKey: true,
      createdAt: true,
    },
  });
  console.log("\n=== CreditLedger rows for these logs ===");
  console.log("count:", ledger.length);
  if (ledger.length) console.log(ledger);

  console.log("\n=== Per-log detail ===");
  for (const r of rows) {
    const inp = r.inputSummary as Record<string, unknown> | null;
    const input = inp?.input as Record<string, unknown> | undefined;
    const msgs = input?.messages as { role?: string; content?: unknown }[] | undefined;
    const user = Array.isArray(msgs)
      ? msgs.find((m) => m.role === "user")
      : undefined;
    const snippet =
      typeof user?.content === "string"
        ? user.content.slice(0, 60).replace(/\n/g, " ")
        : null;

    console.log({
      id: r.id.slice(0, 10),
      model: r.model,
      submittedAt: r.submittedAt.toISOString().slice(0, 19),
      durationMs: r.durationMs,
      tokens: {
        prompt: r.promptTokens,
        completion: r.completionTokens,
        total: r.totalTokens,
        hasTokenUsage: r.hasTokenUsage,
        metricsSource: r.metricsSource,
      },
      estimatedVendorCostYuan: r.estimatedVendorCostYuan
        ? Number(r.estimatedVendorCostYuan)
        : null,
      creditsCharged: r.creditsCharged,
      billingMode: r.billingMode,
      vendorRequestId: r.vendorRequestId?.slice(0, 20) ?? null,
      userSnippet: snippet,
      resultSummary: r.resultSummary ? "present" : null,
    });
  }

  // Also check if any SUCCEEDED CHAT around same period for comparison
  const succeededChat = await prisma.gatewayRequestLog.count({
    where: {
      requestKind: "CHAT",
      status: "SUCCEEDED",
      clientPage: "platform-assistant/chat",
      submittedAt: {
        gte: rows[0]?.submittedAt ?? new Date("2026-08-20"),
        lte: rows[rows.length - 1]?.submittedAt ?? new Date(),
      },
    },
  });
  const succeededWithUsage = await prisma.gatewayRequestLog.count({
    where: {
      requestKind: "CHAT",
      status: "SUCCEEDED",
      clientPage: "platform-assistant/chat",
      hasTokenUsage: true,
      submittedAt: {
        gte: rows[0]?.submittedAt ?? new Date("2026-08-20"),
        lte: rows[rows.length - 1]?.submittedAt ?? new Date(),
      },
    },
  });
  console.log("\n=== Same window: platform-assistant/chat SUCCEEDED ===");
  console.log({ succeededChat, succeededWithUsage });

  const start = rows[0]?.submittedAt ?? new Date("2026-08-20");
  const end = rows[rows.length - 1]?.submittedAt ?? new Date();
  const windowAll = await prisma.gatewayRequestLog.findMany({
    where: {
      clientPage: "platform-assistant/chat",
      submittedAt: { gte: start, lte: end },
    },
    select: {
      status: true,
      failCode: true,
      metricsSource: true,
      completionTokens: true,
      estimatedVendorCostYuan: true,
      vendorRequestId: true,
    },
  });
  const countIf = (pred: (r: (typeof windowAll)[0]) => boolean) =>
    windowAll.filter(pred).length;
  console.log("\n=== platform-assistant/chat same time window ===");
  console.log("total:", windowAll.length);
  console.log("STALE_CHAT_ORPHAN:", countIf((r) => r.failCode === "STALE_CHAT_ORPHAN"));
  console.log("SUCCEEDED:", countIf((r) => r.status === "SUCCEEDED"));
  console.log("metricsSource VENDOR:", countIf((r) => r.metricsSource === "VENDOR"));
  console.log("completionTokens > 0:", countIf((r) => (r.completionTokens ?? 0) > 0));
  console.log("vendorRequestId set:", countIf((r) => !!r.vendorRequestId));
  console.log(
    "estimatedVendorCostYuan > 0:",
    countIf((r) => r.estimatedVendorCostYuan && Number(r.estimatedVendorCostYuan) > 0),
  );

  // Dedupe: unique user turns (approx) among orphans — exclude fallback duplicates same minute
  console.log("\n=== Orphan: likely vendor HTTP attempts ===");
  console.log(
    "Gateway initiated upstream calls (1 log ≈ 1 HTTP attempt):",
    rows.length,
  );
  console.log(
    "With vendor-reported usage (metricsSource=VENDOR):",
    rows.filter((r) => r.metricsSource === "VENDOR").length,
  );
  console.log(
    "With model output recorded (completionTokens>0):",
    rows.filter((r) => (r.completionTokens ?? 0) > 0).length,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
