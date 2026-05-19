/**
 * 一次性 realign：以 tool-web/doc/price_0518.md (B) 为唯一基线，重整 ToolBillablePrice (D)。
 *
 * 行为：
 *  - 视频类（VIDEO_MODEL_SPEC）：把 D 中"无 cloudTierRaw 的旧单行"标记 active=false；
 *    按 EXPECTATIONS 列表为每个 (toolKey, action, schemeARefModelKey, cloudTierRaw)
 *    新建/更新一行，cost=挂牌价、M=2、pricePoints=round(cost × 2 × 100)。
 *  - 图片类（OUTPUT_IMAGE / COST_PER_IMAGE）：直接 upsert 同一行的 cost/M/pricePoints
 *    （这些行原本对齐，只补一遍以保证字段齐全）。
 *  - 千问/视觉分析（TOKEN_IN_OUT）：暂保持"每次固定 pricePoints"路径不变；
 *    但用挂牌的 (input + output) / 2 重新折算 cost，然后回填 pricePoints = round(cost × M × 100)
 *    使 D 表对内单价口径与挂牌一致；扣点行为不变（每次按 pricePoints 扣）。
 *
 * 用法（在 book-mall 目录下）：
 *   node_modules/.bin/dotenv -e .env.local -- node_modules/.bin/tsx scripts/pricing-realign-from-price-md.ts          # dry-run
 *   node_modules/.bin/dotenv -e .env.local -- node_modules/.bin/tsx scripts/pricing-realign-from-price-md.ts --apply  # 写库
 */
import { PricingBillingKind, type ToolBillablePrice } from "@prisma/client";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");
const RETAIL_M = 2;

type ImageExpect = {
  toolKey: string;
  action: string;
  schemeARefModelKey: string;
  cloudModelKey: string;
  cloudTierRaw: string; // 图片类通常 ""；refiner 为阶梯 tierRaw
  cloudBillingKind: "OUTPUT_IMAGE" | "COST_PER_IMAGE";
  costYuan: number;
  note?: string;
};

type VideoExpect = {
  toolKey: string;
  action: string;
  schemeARefModelKey: string;
  cloudModelKey: string;
  cloudTierRaw: string; // "720P" / "1080P" / "360P" / "720P|audio" / "720P|silent" 等
  cloudBillingKind: "VIDEO_MODEL_SPEC";
  costYuan: number;
  note?: string;
};

type TokenExpect = {
  toolKey: string;
  action: string;
  schemeARefModelKey: string;
  cloudModelKey: string;
  cloudTierRaw: string; // 与 PricingSourceLine.tierRaw 同步：如 "0<Token≤256K" / "无阶梯计价"
  cloudBillingKind: "TOKEN_IN_OUT";
  costYuan: number; // 折算后的对内单一指标 = (input + output) / 2，元/百万 token
  note?: string;
};

type Expect = ImageExpect | VideoExpect | TokenExpect;

function videoTier(sr: number, opts?: { audio?: boolean }): string {
  const base = `${sr}P`;
  if (opts?.audio === true) return `${base}|audio`;
  if (opts?.audio === false) return `${base}|silent`;
  return base;
}

const TOOL_VIDEO = "image-to-video";
const TOOL_FITTING = "fitting-room__ai-fit";
const TOOL_T2I = "text-to-image";
const TOOL_VL = "visual-lab__analysis";

/**
 * 期望表：以 price_0518.md（中国内地）为准；M=2；pricePoints 由脚本计算。
 * 添加新模型只需在此处加一行，再跑 --apply 即可。
 */
const EXPECTATIONS: Expect[] = [
  // ============ 图片：AI 试衣 ============
  {
    toolKey: TOOL_FITTING,
    action: "try_on",
    schemeARefModelKey: "aitryon",
    cloudModelKey: "aitryon",
    cloudTierRaw: "",
    cloudBillingKind: "OUTPUT_IMAGE",
    costYuan: 0.2,
    note: "AI 试衣 基础版（按张）",
  },
  {
    toolKey: TOOL_FITTING,
    action: "try_on",
    schemeARefModelKey: "aitryon-plus",
    cloudModelKey: "aitryon-plus",
    cloudTierRaw: "",
    cloudBillingKind: "OUTPUT_IMAGE",
    costYuan: 0.5,
    note: "AI 试衣 Plus版（按张）",
  },
  {
    toolKey: TOOL_FITTING,
    action: "try_on",
    schemeARefModelKey: "aitryon-parsing-v1",
    cloudModelKey: "aitryon-parsing-v1",
    cloudTierRaw: "",
    cloudBillingKind: "COST_PER_IMAGE",
    costYuan: 0.004,
    note: "AI 试衣-图片分割（按输入张）",
  },
  ...([
    { tier: "生成≤25张", cost: 0.3 },
    { tier: "25<生成≤125张", cost: 0.275 },
    { tier: "125<生成≤250张", cost: 0.25 },
    { tier: "250<生成≤1250张", cost: 0.225 },
    { tier: "1250<生成≤2500张", cost: 0.2 },
    { tier: "2500<生成≤2.5万张", cost: 0.175 },
    { tier: ">2.5万张", cost: 0.15 },
  ] as const).map<ImageExpect>(({ tier, cost }) => ({
    toolKey: TOOL_FITTING,
    action: "try_on",
    schemeARefModelKey: "aitryon-refiner",
    cloudModelKey: "aitryon-refiner",
    cloudTierRaw: tier,
    cloudBillingKind: "OUTPUT_IMAGE",
    costYuan: cost,
    note: `AI 试衣精修 ${tier}`,
  })),
  // ============ 图片：文生图 ============
  {
    toolKey: TOOL_T2I,
    action: "invoke",
    schemeARefModelKey: "wanx2.1-t2i-plus",
    cloudModelKey: "wanx2.1-t2i-plus",
    cloudTierRaw: "",
    cloudBillingKind: "COST_PER_IMAGE",
    costYuan: 0.2,
    note: "万相文生图 wanx2.1-t2i-plus（按张）",
  },
  // ============ 视频：happyhorse 系列（720P 0.9 / 1080P 1.6） ============
  ...(["happyhorse-1.0-i2v", "happyhorse-1.0-t2v", "happyhorse-1.0-r2v", "happyhorse-1.0-video-edit"] as const).flatMap(
    (mk) =>
      ([
        { sr: 720, c: 0.9 },
        { sr: 1080, c: 1.6 },
      ] as const).map<VideoExpect>(({ sr, c }) => ({
        toolKey: TOOL_VIDEO,
        action: "invoke",
        schemeARefModelKey: mk,
        cloudModelKey: mk,
        cloudTierRaw: videoTier(sr),
        cloudBillingKind: "VIDEO_MODEL_SPEC",
        costYuan: c,
        note: `${mk} ${sr}P（元/秒）`,
      })),
  ),
  // ============ 视频：wan2.7 全 720P 0.6 / 1080P 1.0 ============
  ...(["wan2.7-i2v", "wan2.7-i2v-2026-04-25", "wan2.7-t2v", "wan2.7-t2v-2026-04-25", "wan2.7-r2v"] as const).flatMap(
    (mk) =>
      ([
        { sr: 720, c: 0.6 },
        { sr: 1080, c: 1.0 },
      ] as const).map<VideoExpect>(({ sr, c }) => ({
        toolKey: TOOL_VIDEO,
        action: "invoke",
        schemeARefModelKey: mk,
        cloudModelKey: mk,
        cloudTierRaw: videoTier(sr),
        cloudBillingKind: "VIDEO_MODEL_SPEC",
        costYuan: c,
        note: `${mk} ${sr}P（元/秒）`,
      })),
  ),
  // ============ 视频：wan2.6 标准（i2v / t2v / r2v）720P 0.6 / 1080P 1.0 ============
  ...(["wan2.6-i2v", "wan2.6-t2v", "wan2.6-r2v"] as const).flatMap((mk) =>
    ([
      { sr: 720, c: 0.6 },
      { sr: 1080, c: 1.0 },
    ] as const).map<VideoExpect>(({ sr, c }) => ({
      toolKey: TOOL_VIDEO,
      action: "invoke",
      schemeARefModelKey: mk,
      cloudModelKey: mk,
      cloudTierRaw: videoTier(sr),
      cloudBillingKind: "VIDEO_MODEL_SPEC",
      costYuan: c,
      note: `${mk} ${sr}P（元/秒）`,
    })),
  ),
  // ============ 视频：wan2.6-flash（i2v-flash / r2v-flash）按 audio 拆 ============
  ...(["wan2.6-i2v-flash", "wan2.6-r2v-flash"] as const).flatMap((mk) =>
    ([
      { sr: 720, audio: true, c: 0.3 },
      { sr: 720, audio: false, c: 0.15 },
      { sr: 1080, audio: true, c: 0.5 },
      { sr: 1080, audio: false, c: 0.25 },
    ] as const).map<VideoExpect>(({ sr, audio, c }) => ({
      toolKey: TOOL_VIDEO,
      action: "invoke",
      schemeARefModelKey: mk,
      cloudModelKey: mk,
      cloudTierRaw: videoTier(sr, { audio }),
      cloudBillingKind: "VIDEO_MODEL_SPEC",
      costYuan: c,
      note: `${mk} ${sr}P ${audio ? "audio" : "silent"}（元/秒）`,
    })),
  ),
  // ============ 视频：wan2.5-preview（480P 0.3 / 720P 0.6 / 1080P 1.0） ============
  ...(["wan2.5-i2v-preview", "wan2.5-t2v-preview"] as const).flatMap((mk) =>
    ([
      { sr: 480, c: 0.3 },
      { sr: 720, c: 0.6 },
      { sr: 1080, c: 1.0 },
    ] as const).map<VideoExpect>(({ sr, c }) => ({
      toolKey: TOOL_VIDEO,
      action: "invoke",
      schemeARefModelKey: mk,
      cloudModelKey: mk,
      cloudTierRaw: videoTier(sr),
      cloudBillingKind: "VIDEO_MODEL_SPEC",
      costYuan: c,
      note: `${mk} ${sr}P（元/秒）`,
    })),
  ),
  // ============ 视频：pixverse 系列（仅 360P） ============
  ...(["pixverse-c1-it2v", "pixverse-c1-t2v"] as const).map<VideoExpect>((mk) => ({
    toolKey: TOOL_VIDEO,
    action: "invoke",
    schemeARefModelKey: mk,
    cloudModelKey: mk,
    cloudTierRaw: videoTier(360),
    cloudBillingKind: "VIDEO_MODEL_SPEC",
    costYuan: 0.24,
    note: `${mk} 360P（元/秒）`,
  })),
  ...(["pixverse-v6-it2v", "pixverse-v6-t2v"] as const).map<VideoExpect>((mk) => ({
    toolKey: TOOL_VIDEO,
    action: "invoke",
    schemeARefModelKey: mk,
    cloudModelKey: mk,
    cloudTierRaw: videoTier(360),
    cloudBillingKind: "VIDEO_MODEL_SPEC",
    costYuan: 0.21,
    note: `${mk} 360P（元/秒）`,
  })),
  // ============ Token：千问/视觉分析（visual-lab__analysis）============
  // 折算 cost = (input + output) / 2 元/百万 token（对内单一指标，与扣点保持一致）
  // 真扣点路径不变（每次固定 pricePoints；不按 token 用量动态算）
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen-vl-max",
    cloudModelKey: "qwen-vl-max",
    cloudTierRaw: "无阶梯计价",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (1.6 + 4.0) / 2, // 2.8
    note: "qwen-vl-max 中国内地（input 1.6 + output 4 / 2）",
  },
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen-vl-plus",
    cloudModelKey: "qwen-vl-plus",
    cloudTierRaw: "无阶梯计价",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (0.8 + 2.0) / 2, // 1.4
    note: "qwen-vl-plus 中国内地（input 0.8 + output 2 / 2）",
  },
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen3-vl-plus",
    cloudModelKey: "qwen3-vl-plus",
    cloudTierRaw: "0<Token≤32K",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (1.0 + 10.0) / 2, // 5.5
    note: "qwen3-vl-plus 0<Token≤32K（input 1 + output 10 / 2）",
  },
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen3-vl-flash",
    cloudModelKey: "qwen3-vl-flash",
    cloudTierRaw: "0<Token≤32K",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (0.15 + 1.5) / 2, // 0.825
    note: "qwen3-vl-flash 0<Token≤32K（input 0.15 + output 1.5 / 2）",
  },
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen3.5-plus",
    cloudModelKey: "qwen3.5-plus",
    cloudTierRaw: "0<Token≤128K",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (0.8 + 4.8) / 2, // 2.8
    note: "qwen3.5-plus 0<Token≤128K（非思考模式 input 0.8 + output 4.8 / 2）",
  },
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen3.5-flash",
    cloudModelKey: "qwen3.5-flash",
    cloudTierRaw: "0<Token≤128K",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (0.2 + 2.0) / 2, // 1.1
    note: "qwen3.5-flash 0<Token≤128K（非思考模式 input 0.2 + output 2 / 2）",
  },
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen3.6-plus",
    cloudModelKey: "qwen3.6-plus",
    cloudTierRaw: "0<Token≤256K",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (2.0 + 12.0) / 2, // 7.0
    note: "qwen3.6-plus 0<Token≤256K（非思考模式 input 2 + output 12 / 2）",
  },
  {
    toolKey: TOOL_VL,
    action: "invoke",
    schemeARefModelKey: "qwen3.6-flash",
    cloudModelKey: "qwen3.6-flash",
    cloudTierRaw: "0<Token≤256K",
    cloudBillingKind: "TOKEN_IN_OUT",
    costYuan: (1.2 + 7.2) / 2, // 4.2
    note: "qwen3.6-flash 0<Token≤256K（非思考模式 input 1.2 + output 7.2 / 2）",
  },
];

function expectedPricePoints(costYuan: number): number {
  return Math.max(1, Math.round(costYuan * RETAIL_M * 100));
}

function fmt(e: Expect): string {
  return `${e.toolKey} | ${e.schemeARefModelKey} | tier=${e.cloudTierRaw || "-"} | cost=${e.costYuan} | M=${RETAIL_M} | pp=${expectedPricePoints(e.costYuan)} | kind=${e.cloudBillingKind}`;
}

function rowFmt(r: ToolBillablePrice): string {
  return `id=${r.id} | tier=${r.cloudTierRaw ?? "-"} | cost=${r.schemeAUnitCostYuan} | M=${r.schemeAAdminRetailMultiplier} | pp=${r.pricePoints} | kind=${r.cloudBillingKind} | active=${r.active}`;
}

async function main() {
  console.log(`MODE: ${APPLY ? "APPLY (write to DB)" : "DRY-RUN (read-only)"}`);
  console.log(`期望表条目：${EXPECTATIONS.length}`);
  console.log("");

  const now = new Date();
  const all = await prisma.toolBillablePrice.findMany({
    orderBy: [{ toolKey: "asc" }, { schemeARefModelKey: "asc" }, { cloudTierRaw: "asc" }],
  });
  console.log(`当前 D 表共 ${all.length} 行（含 active/inactive）`);
  console.log("");

  const toCreate: Expect[] = [];
  const toUpdate: Array<{ row: ToolBillablePrice; expect: Expect; reason: string }> = [];
  const toDeactivate: ToolBillablePrice[] = [];
  const upToDate: Array<{ row: ToolBillablePrice; expect: Expect }> = [];

  // 索引：按 (toolKey, action, schemeARefModelKey, cloudTierRaw) → 命中行（取 active 的；多个时取 effectiveFrom 最新）
  function findRow(e: Expect): ToolBillablePrice | undefined {
    const matches = all.filter(
      (r) =>
        r.toolKey === e.toolKey &&
        (r.action ?? "") === e.action &&
        (r.schemeARefModelKey ?? "") === e.schemeARefModelKey &&
        (r.cloudTierRaw ?? "") === e.cloudTierRaw,
    );
    if (matches.length === 0) return undefined;
    const active = matches.filter((m) => m.active);
    if (active.length > 0) {
      return active.sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
    }
    return matches.sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
  }

  for (const e of EXPECTATIONS) {
    const row = findRow(e);
    if (!row) {
      toCreate.push(e);
      continue;
    }
    const reasons: string[] = [];
    if (!row.active) reasons.push(`active=${row.active}→true`);
    if (row.schemeAUnitCostYuan == null || Math.abs(row.schemeAUnitCostYuan - e.costYuan) > 1e-6) {
      reasons.push(`cost ${row.schemeAUnitCostYuan}→${e.costYuan}`);
    }
    if (
      row.schemeAAdminRetailMultiplier == null ||
      Math.abs(row.schemeAAdminRetailMultiplier - RETAIL_M) > 1e-6
    ) {
      reasons.push(`M ${row.schemeAAdminRetailMultiplier}→${RETAIL_M}`);
    }
    const expectedPP = expectedPricePoints(e.costYuan);
    if (row.pricePoints !== expectedPP) {
      reasons.push(`pp ${row.pricePoints}→${expectedPP}`);
    }
    if (row.cloudBillingKind !== e.cloudBillingKind) {
      reasons.push(`kind ${row.cloudBillingKind}→${e.cloudBillingKind}`);
    }
    if ((row.cloudModelKey ?? "") !== e.cloudModelKey) {
      reasons.push(`cloudModelKey ${row.cloudModelKey ?? "-"}→${e.cloudModelKey}`);
    }
    if (reasons.length > 0) {
      toUpdate.push({ row, expect: e, reason: reasons.join("; ") });
    } else {
      upToDate.push({ row, expect: e });
    }
  }

  // 计算 toDeactivate：不在期望表中的视频/图片/Token 旧行
  const expectKey = (e: Expect) =>
    `${e.toolKey}|${e.action}|${e.schemeARefModelKey}|${e.cloudTierRaw}`;
  const expected = new Set(EXPECTATIONS.map(expectKey));
  for (const r of all) {
    if (!r.active) continue;
    const k = `${r.toolKey}|${r.action ?? ""}|${r.schemeARefModelKey ?? ""}|${r.cloudTierRaw ?? ""}`;
    if (expected.has(k)) continue;
    // 仅关停我们管的 toolKey 范围（避免误伤平台未来新增的工具）
    // "fitting-room" 是 v005 之前的旧裸 toolKey 命名，已迁到 "fitting-room__ai-fit"，发现仍 active 即视为遗留，关停。
    if (
      r.toolKey === TOOL_VIDEO ||
      r.toolKey === TOOL_FITTING ||
      r.toolKey === "fitting-room" ||
      r.toolKey === TOOL_T2I ||
      r.toolKey === TOOL_VL
    ) {
      toDeactivate.push(r);
    }
  }

  console.log("══════════════ 已对齐 ══════════════");
  for (const x of upToDate) {
    console.log(`✅ ${fmt(x.expect)}  (id=${x.row.id})`);
  }
  console.log("");
  console.log("══════════════ 需创建 ══════════════");
  for (const e of toCreate) {
    console.log(`➕ ${fmt(e)}  ${e.note ? `// ${e.note}` : ""}`);
  }
  console.log("");
  console.log("══════════════ 需更新 ══════════════");
  for (const u of toUpdate) {
    console.log(`✏️  ${fmt(u.expect)}\n     旧：${rowFmt(u.row)}\n     原因：${u.reason}`);
  }
  console.log("");
  console.log("══════════════ 需关停（active=false）══════════════");
  for (const r of toDeactivate) {
    console.log(`🛑 ${rowFmt(r)} | toolKey=${r.toolKey} | model=${r.schemeARefModelKey ?? "-"}`);
  }
  console.log("");
  console.log(
    `汇总：upToDate=${upToDate.length} toCreate=${toCreate.length} toUpdate=${toUpdate.length} toDeactivate=${toDeactivate.length}`,
  );

  if (!APPLY) {
    console.log("\n（DRY-RUN）未写库。加 --apply 真正执行。");
    return;
  }

  console.log("\n开始写库 ...");
  let createdN = 0;
  let updatedN = 0;
  let deactivatedN = 0;

  await prisma.$transaction(async (tx) => {
    for (const e of toCreate) {
      const pp = expectedPricePoints(e.costYuan);
      const created = await tx.toolBillablePrice.create({
        data: {
          toolKey: e.toolKey,
          action: e.action,
          pricePoints: pp,
          effectiveFrom: now,
          effectiveTo: null,
          active: true,
          note: e.note ?? null,
          schemeARefModelKey: e.schemeARefModelKey,
          schemeAUnitCostYuan: e.costYuan,
          schemeAAdminRetailMultiplier: RETAIL_M,
          cloudModelKey: e.cloudModelKey,
          cloudTierRaw: e.cloudTierRaw || null,
          cloudBillingKind: e.cloudBillingKind as PricingBillingKind,
        },
      });
      console.log(`  ➕ created id=${created.id} ${fmt(e)}`);
      createdN++;
    }
    for (const u of toUpdate) {
      const pp = expectedPricePoints(u.expect.costYuan);
      const upd = await tx.toolBillablePrice.update({
        where: { id: u.row.id },
        data: {
          pricePoints: pp,
          active: true,
          schemeAUnitCostYuan: u.expect.costYuan,
          schemeAAdminRetailMultiplier: RETAIL_M,
          cloudModelKey: u.expect.cloudModelKey,
          cloudTierRaw: u.expect.cloudTierRaw || null,
          cloudBillingKind: u.expect.cloudBillingKind as PricingBillingKind,
          note: u.expect.note ?? u.row.note,
        },
      });
      console.log(`  ✏️  updated id=${upd.id} ${fmt(u.expect)}`);
      updatedN++;
    }
    for (const r of toDeactivate) {
      await tx.toolBillablePrice.update({
        where: { id: r.id },
        data: {
          active: false,
          effectiveTo: now,
          note: `${r.note ?? ""} [deprecated by realign-2026-05-18: 已被分档位行替代]`.trim(),
        },
      });
      console.log(`  🛑 deactivated id=${r.id} ${rowFmt(r)}`);
      deactivatedN++;
    }
  });

  console.log("");
  console.log(`完成：created=${createdN} updated=${updatedN} deactivated=${deactivatedN}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
