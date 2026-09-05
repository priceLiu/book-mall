/**
 * DeepSeek V4 成本档 + 积分报价发布（关旧开新）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/seed-deepseek-v4-costs-and-credits.ts
 */
import { CreditChannel, CreditCostUnit } from "@prisma/client";

import { publishModelCreditPrice } from "../lib/pricing/credit-pricing-engine";
import {
  DEEPSEEK_PRICING_DOC_URL,
  DEEPSEEK_V4_LIST_PRICES,
} from "../lib/pricing/deepseek-v4-pricing";
import { upsertModelCostProfileVersioned } from "../lib/pricing/upsert-model-cost-profile-versioned";
import { prisma } from "../lib/prisma";

async function upsertDeepseekCostProfile(row: (typeof DEEPSEEK_V4_LIST_PRICES)[number]) {
  const note = `${row.note} · ${DEEPSEEK_PRICING_DOC_URL}`;
  const existing = await prisma.modelCostProfile.findFirst({
    where: {
      canonicalModelKey: row.canonicalModelKey,
      vendor: "deepseek",
      channel: CreditChannel.OWN,
      active: true,
      effectiveTo: null,
    },
    select: { id: true },
  });

  const result = await upsertModelCostProfileVersioned({
    vendor: "deepseek",
    canonicalModelKey: row.canonicalModelKey,
    channel: CreditChannel.OWN,
    unit: CreditCostUnit.PER_KTOKEN,
    listCostYuan: row.inputListCostYuan,
    inputListCostYuan: row.inputListCostYuan,
    outputListCostYuan: row.outputListCostYuan,
    discountRate: 0,
    note,
    seedId: existing ? undefined : `seed-deepseek-${row.canonicalModelKey}-OWN`,
  });
  return result.profileId;
}

async function main() {
  console.log(`[deepseek-v4] pricing doc: ${DEEPSEEK_PRICING_DOC_URL}`);

  for (const row of DEEPSEEK_V4_LIST_PRICES) {
    const profileId = await upsertDeepseekCostProfile(row);
    console.log(
      `[profile] ${row.canonicalModelKey} in=${row.inputListCostYuan}/K out=${row.outputListCostYuan}/K id=${profileId}`,
    );

    const r = await publishModelCreditPrice({
      canonicalModelKey: row.canonicalModelKey,
      displayName: row.displayName,
      publishedBy: "seed-deepseek-v4-costs-and-credits",
    });
    console.log(
      `[credit] ${r.canonicalModelKey} in=${r.listPriceYuan} credits/U=${r.creditsPerUnit} margin=${(r.baseMarginRate * 100).toFixed(1)}%`,
    );
  }

  const flash = DEEPSEEK_V4_LIST_PRICES.find((r) => r.canonicalModelKey === "deepseek-v4-flash");
  if (flash) {
    const legacyExisting = await prisma.modelCostProfile.findFirst({
      where: { canonicalModelKey: "deepseek-chat", vendor: "deepseek", active: true, effectiveTo: null },
      select: { id: true },
    });
    if (legacyExisting) {
      await upsertModelCostProfileVersioned({
        vendor: "deepseek",
        canonicalModelKey: "deepseek-chat",
        channel: CreditChannel.OWN,
        unit: CreditCostUnit.PER_KTOKEN,
        listCostYuan: flash.inputListCostYuan,
        inputListCostYuan: flash.inputListCostYuan,
        outputListCostYuan: flash.outputListCostYuan,
        discountRate: 0,
        note: `legacy alias → v4-flash · ${DEEPSEEK_PRICING_DOC_URL}`,
      });
      try {
        await publishModelCreditPrice({
          canonicalModelKey: "deepseek-chat",
          displayName: "DeepSeek Chat (legacy)",
          publishedBy: "seed-deepseek-v4-costs-and-credits",
        });
        console.log("[credit] deepseek-chat legacy alias republished");
      } catch (e) {
        console.warn(`[skip] deepseek-chat: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  console.log("[done] DeepSeek V4 costs + credits published");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
