/**
 * 一次性：扫描并安全修复 Gateway 阻塞（CHAT 漏收口 / expire / 看门狗 / 画布排队）。
 *   pnpm --dir book-mall exec dotenv -e .env.local -- tsx scripts/heal-gateway-health.ts
 */
import { healGatewayHealth } from "@/lib/gateway/gateway-health-service";

async function main() {
  const r = await healGatewayHealth({ source: "cli" });
  console.log(
    JSON.stringify(
      {
        before: {
          opsHealth: r.before.opsHealth,
          alerts: r.before.alerts,
          counts: r.before.counts,
        },
        heal: {
          staleChatClosed: r.heal.staleChatClosed,
          expired: r.heal.expired,
          canvasRecovered: r.heal.canvasRecovered,
          statsReconciled: r.heal.statsReconciled,
        },
        after: {
          opsHealth: r.after.opsHealth,
          alerts: r.after.alerts,
          counts: r.after.counts,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
