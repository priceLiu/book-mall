/**
 * 确认平台侧已无 canvas 历史 Key（sk-918f…）残留。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/audit-legacy-deepseek-canvas-key.ts
 */
import { prisma } from "../lib/prisma";
import { decryptApiKey, maskApiKey } from "../lib/canvas/secret";

const CANVAS_LEGACY_PREFIX = "sk-918f";

function keyPrefix(encrypted: string): string {
  try {
    return decryptApiKey(encrypted).slice(0, 8);
  } catch {
    return "?";
  }
}

async function main() {
  let failed = false;

  const envKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (envKey) {
    failed = true;
    console.error(
      "[FAIL] process.env.DEEPSEEK_API_KEY 仍存在（应删除；DeepSeek 仅经 Gateway · book mall / gw-* Key）",
    );
    console.error(`       masked=${maskApiKey(envKey)} prefix=${envKey.slice(0, 8)}`);
  } else {
    console.log("[OK] 无 DEEPSEEK_API_KEY env");
  }

  const gwCreds = await prisma.gatewayVendorCredential.findMany({
    where: { providerKind: "DEEPSEEK" },
    select: { id: true, alias: true, channel: true, active: true, apiKeyEncrypted: true },
  });
  for (const c of gwCreds) {
    const prefix = keyPrefix(c.apiKeyEncrypted);
    if (prefix.startsWith(CANVAS_LEGACY_PREFIX)) {
      failed = true;
      console.error(
        `[FAIL] Gateway DEEPSEEK 凭证仍含 canvas 历史 Key: id=${c.id} channel=${c.channel ?? "null"} masked=${maskApiKey(c.apiKeyEncrypted)}`,
      );
    }
  }
  if (!gwCreds.some((c) => keyPrefix(c.apiKeyEncrypted).startsWith(CANVAS_LEGACY_PREFIX))) {
    console.log(`[OK] Gateway DEEPSEEK 凭证 ${gwCreds.length} 条均非 canvas 历史 Key`);
  }

  const canvasProviders = await prisma.canvasProvider.findMany({
    where: { baseUrl: { contains: "deepseek" } },
    select: { id: true, alias: true, active: true, apiKeyEncrypted: true },
  });
  for (const p of canvasProviders) {
    const prefix = keyPrefix(p.apiKeyEncrypted);
    if (prefix.startsWith(CANVAS_LEGACY_PREFIX)) {
      failed = true;
      console.error(
        `[FAIL] CanvasProvider 仍绑 canvas 历史 Key: id=${p.id} alias=${p.alias} masked=${maskApiKey(p.apiKeyEncrypted)}`,
      );
    }
  }
  if (
    !canvasProviders.some((p) =>
      keyPrefix(p.apiKeyEncrypted).startsWith(CANVAS_LEGACY_PREFIX),
    )
  ) {
    console.log(
      `[OK] deepseek CanvasProvider ${canvasProviders.length} 条均非 canvas 历史 Key`,
    );
  }

  if (failed) process.exit(1);
  console.log("\n[audit-legacy-deepseek-canvas-key] 通过");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
