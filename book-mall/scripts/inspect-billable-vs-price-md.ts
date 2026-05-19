/**
 * 长期使用：核查 ToolBillablePrice (D) 是否与 tool-web/doc/price_0518.md (B) 对齐。
 *   B（人工抽取版）写在脚本下方 PRICE_MD 内。
 *   增/改云挂牌价时同步更新此处 + 跑 pricing-realign-from-price-md.ts --apply。
 *
 * 用法（在 book-mall 下）：
 *   node_modules/.bin/dotenv -e .env.local -- node_modules/.bin/tsx scripts/inspect-billable-vs-price-md.ts
 *   exit 0 = 全部对齐；非 0 = 有偏差。
 */
import { prisma } from "../lib/prisma";
import { REFINER_VOLUME_TIERS } from "../lib/pricing/ai-tryon-cost";

/** B：把 price_0518.md 中"中国内地"段对照我们用的模型抽出来；
 *  数值原样来自该 md（截至 2026-05-18 校对的版本）。
 *  键：apiModel, 值：bySr {tier: 元/单位}。video 单位 = 元/秒；image 单位 = 元/张。
 */
const PRICE_MD: Record<
  string,
  | { kind: "image_per"; perUnitYuan: number }
  | {
      kind: "image_per_volume_tier";
      tiers: ReadonlyArray<{ tierRaw: string; costYuan: number }>;
    }
  | { kind: "video_per_sec_bySr"; bySr: Record<string, number> }
  | { kind: "video_per_sec_bySrAudio"; bySrAudio: Record<string, { true: number; false: number }> }
> = {
  // —— 试衣（按张） ——
  aitryon: { kind: "image_per", perUnitYuan: 0.2 },
  "aitryon-plus": { kind: "image_per", perUnitYuan: 0.5 },
  "aitryon-parsing-v1": { kind: "image_per", perUnitYuan: 0.004 },
  "aitryon-refiner": {
    kind: "image_per_volume_tier",
    tiers: REFINER_VOLUME_TIERS.map((t) => ({ tierRaw: t.tierRaw, costYuan: t.costYuan })),
  },
  // —— 文生图（按张） ——
  "wanx2.1-t2i-plus": { kind: "image_per", perUnitYuan: 0.2 },
  // —— happyhorse 视频系列：720P 0.9 / 1080P 1.6 ——
  "happyhorse-1.0-i2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.9, "1080": 1.6 } },
  "happyhorse-1.0-t2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.9, "1080": 1.6 } },
  "happyhorse-1.0-r2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.9, "1080": 1.6 } },
  "happyhorse-1.0-video-edit": { kind: "video_per_sec_bySr", bySr: { "720": 0.9, "1080": 1.6 } },
  // —— wan2.7 ——
  "wan2.7-i2v-2026-04-25": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  "wan2.7-i2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  "wan2.7-t2v-2026-04-25": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  "wan2.7-t2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  "wan2.7-r2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  // —— wan2.6 ——
  "wan2.6-i2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  "wan2.6-t2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  "wan2.6-r2v": { kind: "video_per_sec_bySr", bySr: { "720": 0.6, "1080": 1.0 } },
  "wan2.6-i2v-flash": {
    kind: "video_per_sec_bySrAudio",
    bySrAudio: {
      "720": { true: 0.3, false: 0.15 },
      "1080": { true: 0.5, false: 0.25 },
    },
  },
  "wan2.6-r2v-flash": {
    kind: "video_per_sec_bySrAudio",
    bySrAudio: {
      "720": { true: 0.3, false: 0.15 },
      "1080": { true: 0.5, false: 0.25 },
    },
  },
  // —— wan2.5-preview ——
  "wan2.5-i2v-preview": {
    kind: "video_per_sec_bySr",
    bySr: { "480": 0.3, "720": 0.6, "1080": 1.0 },
  },
  "wan2.5-t2v-preview": {
    kind: "video_per_sec_bySr",
    bySr: { "480": 0.3, "720": 0.6, "1080": 1.0 },
  },
  // —— pixverse 系列（明确 360P）——
  "pixverse-c1-it2v": { kind: "video_per_sec_bySr", bySr: { "360": 0.24 } },
  "pixverse-c1-t2v": { kind: "video_per_sec_bySr", bySr: { "360": 0.24 } },
  "pixverse-v6-it2v": { kind: "video_per_sec_bySr", bySr: { "360": 0.21 } },
  "pixverse-v6-t2v": { kind: "video_per_sec_bySr", bySr: { "360": 0.21 } },
};

function fmtMd(p: (typeof PRICE_MD)[string]): string {
  if (p.kind === "image_per") return `${p.perUnitYuan} 元/张`;
  if (p.kind === "image_per_volume_tier") {
    return p.tiers.map((t) => `${t.tierRaw}:${t.costYuan}`).join(" / ");
  }
  if (p.kind === "video_per_sec_bySr") {
    return Object.entries(p.bySr)
      .map(([sr, v]) => `${sr}P:${v}`)
      .join(" / ");
  }
  return Object.entries(p.bySrAudio)
    .map(([sr, ab]) => `${sr}P[A=${ab.true}/N=${ab.false}]`)
    .join(" / ");
}

async function main() {
  const rows = await prisma.toolBillablePrice.findMany({
    where: { active: true },
    select: {
      id: true,
      toolKey: true,
      action: true,
      schemeARefModelKey: true,
      cloudModelKey: true,
      cloudTierRaw: true,
      cloudBillingKind: true,
      schemeAUnitCostYuan: true,
      schemeAAdminRetailMultiplier: true,
      pricePoints: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
    orderBy: [
      { toolKey: "asc" },
      { schemeARefModelKey: "asc" },
      { cloudTierRaw: "asc" },
    ],
  });

  console.log(`ToolBillablePrice active 行：${rows.length}`);
  console.log("");

  // 按 schemeARefModelKey 聚合
  const byModel = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.schemeARefModelKey ?? "(no-ref-model)";
    const arr = byModel.get(k) ?? [];
    arr.push(r);
    byModel.set(k, arr);
  }

  type Issue = {
    severity: "❌" | "⚠️" | "ℹ️";
    modelKey: string;
    rowId: string;
    desc: string;
  };
  const issues: Issue[] = [];

  for (const [modelKey, list] of Array.from(byModel.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const md = PRICE_MD[modelKey];
    console.log(`────── ${modelKey} ──────`);
    if (md) console.log(`  price_0518.md (B): ${fmtMd(md)}`);
    else console.log(`  price_0518.md (B): (未在我们参考列表中)`);
    for (const r of list) {
      console.log(
        `  D · ${r.toolKey} | action=${r.action ?? "*"} | tier=${r.cloudTierRaw ?? "-"} | kind=${r.cloudBillingKind} | cost=${r.schemeAUnitCostYuan} | M=${r.schemeAAdminRetailMultiplier} | pricePoints=${r.pricePoints}`,
      );

      // 检查 D 的 cost vs B
      if (md) {
        const cost = r.schemeAUnitCostYuan;
        const rawTier = (r.cloudTierRaw ?? "").trim();
        // 解析 tier：支持 "720P|audio" / "720P|silent" / "720P" / "720" / "无阶梯计价" / "0<Token≤32K"
        const m = rawTier.match(/^(\d{3,4})P?(?:\|(audio|silent))?$/i);
        const tierSr = m ? m[1]! : "";
        const tierAudio: "audio" | "silent" | "" = m && m[2] ? (m[2].toLowerCase() as "audio" | "silent") : "";
        if (md.kind === "image_per") {
          if (cost == null || Math.abs(cost - md.perUnitYuan) > 1e-6) {
            issues.push({
              severity: "❌",
              modelKey,
              rowId: r.id,
              desc: `cost=${cost} ≠ 挂牌 ${md.perUnitYuan} 元/张`,
            });
          }
        } else if (md.kind === "image_per_volume_tier") {
          const hit = md.tiers.find((t) => t.tierRaw === rawTier);
          if (!hit) {
            issues.push({
              severity: "⚠️",
              modelKey,
              rowId: r.id,
              desc: `tier=${rawTier || "-"} 不在 refiner 挂牌档位中`,
            });
          } else if (cost == null || Math.abs(cost - hit.costYuan) > 1e-6) {
            issues.push({
              severity: "❌",
              modelKey,
              rowId: r.id,
              desc: `cost=${cost} ≠ 挂牌 ${hit.tierRaw} ${hit.costYuan} 元/张`,
            });
          }
        } else if (md.kind === "video_per_sec_bySr") {
          const expected = md.bySr[tierSr];
          if (expected == null) {
            issues.push({
              severity: "⚠️",
              modelKey,
              rowId: r.id,
              desc: `tier=${r.cloudTierRaw} 不在挂牌档位中（挂牌：${Object.keys(md.bySr).join("/")}）`,
            });
          } else if (cost == null || Math.abs(cost - expected) > 1e-6) {
            issues.push({
              severity: "❌",
              modelKey,
              rowId: r.id,
              desc: `cost=${cost} ≠ 挂牌 ${tierSr}P ${expected} 元/秒`,
            });
          }
        } else if (md.kind === "video_per_sec_bySrAudio") {
          const ab = md.bySrAudio[tierSr];
          if (!ab) {
            issues.push({
              severity: "⚠️",
              modelKey,
              rowId: r.id,
              desc: `tier=${r.cloudTierRaw} 不在挂牌档位中（挂牌：${Object.keys(md.bySrAudio).join("/")}）`,
            });
          } else if (tierAudio === "") {
            issues.push({
              severity: "⚠️",
              modelKey,
              rowId: r.id,
              desc: `tier=${r.cloudTierRaw} 缺 audio/silent 后缀（按音频细分模型必须区分）`,
            });
          } else {
            const expected = tierAudio === "audio" ? ab.true : ab.false;
            if (cost == null || Math.abs(cost - expected) > 1e-6) {
              issues.push({
                severity: "❌",
                modelKey,
                rowId: r.id,
                desc: `cost=${cost} ≠ 挂牌 ${tierSr}P ${tierAudio} ${expected} 元/秒`,
              });
            }
          }
        }
      }

      // 检查 M
      if (
        r.schemeAAdminRetailMultiplier != null &&
        Math.abs(r.schemeAAdminRetailMultiplier - 2) > 1e-6
      ) {
        issues.push({
          severity: "⚠️",
          modelKey,
          rowId: r.id,
          desc: `M=${r.schemeAAdminRetailMultiplier} ≠ 2（约定）`,
        });
      }
    }

    // 检查"应有的档位"是否在 D 中都对应了行
    if (md && md.kind === "video_per_sec_bySr") {
      const tiersInD = new Set(
        list
          .map((r) => {
            const m = (r.cloudTierRaw ?? "").trim().match(/^(\d{3,4})P?$/i);
            return m ? m[1]! : "";
          })
          .filter((t) => t.length > 0),
      );
      for (const t of Object.keys(md.bySr)) {
        if (!tiersInD.has(t)) {
          issues.push({
            severity: "❌",
            modelKey,
            rowId: "(no row)",
            desc: `挂牌档位 ${t}P 在 D 中没有对应的行`,
          });
        }
      }
    }
    if (md && md.kind === "image_per_volume_tier") {
      const tiersInD = new Set(list.map((r) => (r.cloudTierRaw ?? "").trim()));
      for (const t of md.tiers) {
        if (!tiersInD.has(t.tierRaw)) {
          issues.push({
            severity: "❌",
            modelKey,
            rowId: "(no row)",
            desc: `挂牌档位 ${t.tierRaw} 在 D 中没有对应的行`,
          });
        }
      }
    }
    if (md && md.kind === "video_per_sec_bySrAudio") {
      const expected = new Set<string>();
      for (const sr of Object.keys(md.bySrAudio)) {
        expected.add(`${sr}P|audio`);
        expected.add(`${sr}P|silent`);
      }
      const tiersInD = new Set(list.map((r) => (r.cloudTierRaw ?? "").trim()));
      for (const t of expected) {
        if (!tiersInD.has(t)) {
          issues.push({
            severity: "❌",
            modelKey,
            rowId: "(no row)",
            desc: `挂牌档位 ${t} 在 D 中没有对应的行`,
          });
        }
      }
    }
    console.log("");
  }

  console.log("════════ 偏差汇总 ════════");
  if (issues.length === 0) {
    console.log("✅ 全部对齐。");
  } else {
    for (const i of issues) {
      console.log(`${i.severity} ${i.modelKey} [${i.rowId}]  ${i.desc}`);
    }
    console.log(`\n共 ${issues.length} 项偏差。`);
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
