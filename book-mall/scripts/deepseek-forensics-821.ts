/**
 * Phase 0 baseline: 8/21 Gateway DEEPSEEK logs vs vendor CSV gap.
 */
import { readFileSync } from "node:fs";
import { parse as parseCsv } from "csv-parse/sync";

import { prisma } from "../lib/prisma";

async function main() {
  const from = new Date("2026-08-21T00:00:00+08:00");
  const to = new Date("2026-08-21T23:59:59+08:00");

  const byStatus = await prisma.gatewayRequestLog.groupBy({
    by: ["status", "providerKind"],
    where: { submittedAt: { gte: from, lte: to }, providerKind: "DEEPSEEK" },
    _count: true,
    _sum: { promptTokens: true, completionTokens: true },
  });
  console.log("=== 8/21 Gateway DEEPSEEK by status ===");
  console.log(JSON.stringify(byStatus, null, 2));

  const creds = await prisma.gatewayVendorCredential.findMany({
    where: { providerKind: "DEEPSEEK" },
    select: {
      id: true,
      alias: true,
      providerKind: true,
      isDefaultForProvider: true,
      ownerScope: true,
      channel: true,
    },
  });
  console.log("\n=== DEEPSEEK GatewayVendorCredential ===");
  console.log(JSON.stringify(creds, null, 2));

  const amountPath =
    "/Users/vic.liu/.cursor/projects/Users-vic-liu-Documents-doing-private-website/attachments/b381bae4-2798-4d88-85c0-a2c3ef3146b9/amount-2026-07-24_2026-08-22.csv";
  try {
    const rows = parseCsv(readFileSync(amountPath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];
    const groups = new Map<string, { req: number; ktok: number }>();
    for (const r of rows) {
      if (!r.start_time_iso?.startsWith("2026-08-21")) continue;
      const key = `${r.api_key_name}|${r.model}`;
      const cur = groups.get(key) ?? { req: 0, ktok: 0 };
      const amt = Number(r.amount) || 0;
      if (r.type === "request_count") cur.req += amt;
      if (
        r.type === "input_cache_hit_tokens" ||
        r.type === "input_cache_miss_tokens" ||
        r.type === "output_tokens"
      ) {
        cur.ktok += amt;
      }
      groups.set(key, cur);
    }
    console.log("\n=== 8/21 Vendor amount CSV by api_key ===");
    for (const [k, v] of [...groups.entries()].sort((a, b) => b[1].req - a[1].req)) {
      console.log(k, "req", v.req, "KTok", (v.ktok / 1000).toFixed(1));
    }
  } catch (e) {
    console.warn("Vendor CSV not found, skip:", (e as Error).message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
