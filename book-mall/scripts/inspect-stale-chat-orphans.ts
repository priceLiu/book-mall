import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.gatewayRequestLog.findMany({
    where: { failCode: "STALE_CHAT_ORPHAN", requestKind: "CHAT" },
    orderBy: { submittedAt: "desc" },
    take: 30,
    select: {
      model: true,
      clientPage: true,
      clientSource: true,
      endpoint: true,
      submittedAt: true,
      durationMs: true,
      inputSummary: true,
    },
  });

  const byPage = new Map<string, number>();
  const byModel = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const r of rows) {
    const p = r.clientPage ?? "(null)";
    byPage.set(p, (byPage.get(p) ?? 0) + 1);
    byModel.set(r.model, (byModel.get(r.model) ?? 0) + 1);
    bySource.set(r.clientSource, (bySource.get(r.clientSource) ?? 0) + 1);
  }

  console.log("total STALE_CHAT_ORPHAN:", rows.length);
  console.log("by clientPage:", Object.fromEntries(byPage));
  console.log("by model:", Object.fromEntries(byModel));
  console.log("by clientSource:", Object.fromEntries(bySource));

  for (const r of rows.slice(0, 8)) {
    const inp = r.inputSummary as Record<string, unknown> | null;
    const input = inp?.input as Record<string, unknown> | undefined;
    const msgs = input?.messages as { role?: string; content?: unknown }[] | undefined;
    const user = Array.isArray(msgs)
      ? msgs.find((m) => m.role === "user")
      : undefined;
    const snippet =
      typeof user?.content === "string"
        ? user.content.slice(0, 120).replace(/\n/g, " ")
        : null;
    console.log("---");
    console.log({
      model: r.model,
      clientPage: r.clientPage,
      clientSource: r.clientSource,
      stream: input?.stream,
      submittedAt: r.submittedAt.toISOString(),
      ageHours: r.durationMs ? Math.round(r.durationMs / 3_600_000) : null,
      userSnippet: snippet,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
