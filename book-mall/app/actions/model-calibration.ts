"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { ModelAliasSource, PricingBillingKind } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  upsertModelCatalogWithAliases,
  setAliasCatalog,
  detachAlias,
  ingestCandidateAliases,
  runFullAutoCalibration,
  type UpsertModelCatalogInput,
} from "@/lib/model-catalog";
// 注意：本文件是 `"use server"`，只能 export async 函数。
// `CalibrationActionState` / `calibrationActionIdle` 已迁到 `./model-calibration-state`，
// 仅以 `import type` 引入（TS 编译时擦除，不留 runtime export）。
import type { CalibrationActionState } from "./model-calibration-state";

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    throw new Error("无权操作");
  }
}

function isBillingKind(v: string): v is PricingBillingKind {
  return (Object.values(PricingBillingKind) as string[]).includes(v);
}

function isAliasSource(v: string): v is ModelAliasSource {
  return (Object.values(ModelAliasSource) as string[]).includes(v);
}

/**
 * v003 单个录入：新建或更新一个 ModelCatalog + 一组别名。
 * 前端表单字段：canonicalKey/displayName/vendor/billingKind/unitLabel/defaultTierRaw/note/active；
 * 别名以 aliases JSON 字符串提交（数组每项含 source/aliasValue/tierRawHint）。
 */
export async function upsertModelCatalogAction(
  _prev: CalibrationActionState,
  formData: FormData,
): Promise<CalibrationActionState> {
  try {
    await assertAdmin();
    const canonicalKey = String(formData.get("canonicalKey") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const vendor = String(formData.get("vendor") ?? "").trim();
    const billingKindRaw = String(formData.get("billingKind") ?? "").trim();
    const unitLabel = String(formData.get("unitLabel") ?? "").trim();
    const defaultTierRaw =
      String(formData.get("defaultTierRaw") ?? "").trim() || undefined;
    const note = String(formData.get("note") ?? "").trim() || undefined;
    const active = formData.get("active") !== "off";

    if (!canonicalKey) return { kind: "error", message: "标准模型 key 必填" };
    if (!displayName) return { kind: "error", message: "显示名必填" };
    if (!vendor) return { kind: "error", message: "厂商必填" };
    if (!unitLabel) return { kind: "error", message: '单位（如"元/秒"）必填' };
    if (!isBillingKind(billingKindRaw)) {
      return { kind: "error", message: "计费维度（billingKind）不合法" };
    }

    let aliases: UpsertModelCatalogInput["aliases"] = [];
    const aliasesJson = String(formData.get("aliases") ?? "").trim();
    if (aliasesJson) {
      try {
        const parsed = JSON.parse(aliasesJson) as Array<{
          source?: string;
          aliasValue?: string;
          tierRawHint?: string | null;
        }>;
        if (!Array.isArray(parsed)) throw new Error("aliases 须为数组");
        aliases = parsed
          .filter(
            (a): a is { source: string; aliasValue: string; tierRawHint?: string | null } =>
              typeof a?.source === "string" &&
              typeof a?.aliasValue === "string" &&
              a.aliasValue.trim().length > 0,
          )
          .map((a) => {
            if (!isAliasSource(a.source)) {
              throw new Error(`alias source 不合法：${a.source}`);
            }
            return {
              source: a.source,
              aliasValue: a.aliasValue.trim(),
              tierRawHint: a.tierRawHint?.trim() || null,
            };
          });
      } catch (e) {
        return {
          kind: "error",
          message: `aliases JSON 解析失败：${e instanceof Error ? e.message : "格式不合法"}`,
        };
      }
    }

    const result = await upsertModelCatalogWithAliases({
      canonicalKey,
      displayName,
      vendor,
      billingKind: billingKindRaw,
      unitLabel,
      defaultTierRaw: defaultTierRaw ?? null,
      note: note ?? null,
      active,
      aliases,
    });

    revalidatePath("/admin/finance/model-calibration");
    return {
      kind: "ok",
      message: `${result.created ? "已新建" : "已更新"} ${canonicalKey}，挂载 ${result.attachedAliases} 条别名`,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "保存失败" };
  }
}

/** 接受建议 / 改挂：把一条 alias 挂到指定 catalog。 */
export async function setAliasCatalogAction(
  _prev: CalibrationActionState,
  formData: FormData,
): Promise<CalibrationActionState> {
  try {
    await assertAdmin();
    const aliasId = String(formData.get("aliasId") ?? "").trim();
    const catalogId = String(formData.get("catalogId") ?? "").trim();
    if (!aliasId || !catalogId) {
      return { kind: "error", message: "缺少 aliasId 或 catalogId" };
    }
    await setAliasCatalog({ aliasId, catalogId });
    revalidatePath("/admin/finance/model-calibration");
    return { kind: "ok", message: "已挂载" };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "操作失败" };
  }
}

/** 解挂：把 alias 置回 pending。 */
export async function detachAliasAction(
  _prev: CalibrationActionState,
  formData: FormData,
): Promise<CalibrationActionState> {
  try {
    await assertAdmin();
    const aliasId = String(formData.get("aliasId") ?? "").trim();
    if (!aliasId) return { kind: "error", message: "缺少 aliasId" };
    await detachAlias({ aliasId });
    revalidatePath("/admin/finance/model-calibration");
    return { kind: "ok", message: "已解挂" };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "操作失败" };
  }
}

/** 批量接受所有 HIGH 置信度的待审别名（按建议挂载）。 */
export async function acceptAllHighSuggestionsAction(): Promise<{ accepted: number }> {
  await assertAdmin();
  // 当前 alias 行已经在 ingest 时填好了 suggested catalogId；在 pending 里"接受"等价于"以现有 LOW/MEDIUM suggestion 转 MANUAL"。
  // 这里特化：把 confidence=HIGH 且 catalogId IS NULL 的行（极少见，因为 HIGH 时 ingest 一般直接挂上了）尝试自动挂载——保留作回归手段。
  const result = await prisma.modelAlias.findMany({
    where: { active: true, catalogId: null, confidence: "HIGH" },
    select: { id: true, source: true, aliasValue: true },
  });
  // 复用建议器把它们再算一次，HIGH 的建议结果必有 catalogId。
  let accepted = 0;
  for (const a of result) {
    const r = await ingestCandidateAliases([
      { source: a.source, aliasValue: a.aliasValue },
    ]);
    accepted += r.matched > 0 ? 1 : 0;
  }
  revalidatePath("/admin/finance/model-calibration");
  return { accepted };
}

/**
 * v003 一键自动校准：
 *   1) 从 ToolBillablePrice 派生 ModelCatalog（最权威，admin 已认定）；
 *   2) 从 PricingSourceLine（云成本真源，最新当前版本）派生；
 *   3) 把所有 pending alias 重跑 suggest，HIGH/MEDIUM 自动绑定，LOW 留待审。
 * 用作"零手工"启动校准：跑完后费用明细头部 vs 厂商列就自动一致。
 */
export async function runAutoCalibrationAction(): Promise<
  CalibrationActionState & {
    detail?: {
      catalogsCreatedFromBillablePrices: number;
      catalogsCreatedFromPricingSourceLines: number;
      aliasesAttachedHigh: number;
      aliasesAttachedMedium: number;
      pendingLow: number;
    };
  }
> {
  try {
    await assertAdmin();
    const r = await runFullAutoCalibration();
    revalidatePath("/admin/finance/model-calibration");
    const summary = [
      `新建 catalog：按次价${r.catalogsCreatedFromBillablePrices} / 成本源${r.catalogsCreatedFromPricingSourceLines}`,
      `自动绑定 alias：HIGH ${r.aliasesAttachedHigh} / MEDIUM ${r.aliasesAttachedMedium}`,
      `LOW 待审：${r.pendingLow}`,
    ].join("；");
    return { kind: "ok", message: `自动校准完成：${summary}`, detail: r };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "自动校准失败" };
  }
}

/** 批量导入候选别名（粘贴 JSON 数组形式）；用于把云 CSV / price.md 解析后的候选导入。 */
export async function ingestCandidatesAction(
  _prev: CalibrationActionState,
  formData: FormData,
): Promise<CalibrationActionState> {
  try {
    await assertAdmin();
    const raw = String(formData.get("candidates") ?? "").trim();
    if (!raw) return { kind: "error", message: "请粘贴候选 JSON 数组" };
    let arr: unknown;
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      return {
        kind: "error",
        message: `JSON 解析失败：${e instanceof Error ? e.message : "格式不合法"}`,
      };
    }
    if (!Array.isArray(arr)) return { kind: "error", message: "candidates 须为数组" };
    const candidates = arr
      .filter(
        (it): it is { source: string; aliasValue: string; tierRawHint?: string | null } =>
          typeof (it as { source?: unknown })?.source === "string" &&
          typeof (it as { aliasValue?: unknown })?.aliasValue === "string",
      )
      .map((it) => {
        if (!isAliasSource(it.source)) {
          throw new Error(`source 不合法：${it.source}`);
        }
        return {
          source: it.source,
          aliasValue: String(it.aliasValue).trim(),
          tierRawHint: it.tierRawHint ? String(it.tierRawHint).trim() : null,
        };
      })
      .filter((it) => it.aliasValue.length > 0);
    const summary = await ingestCandidateAliases(candidates);
    revalidatePath("/admin/finance/model-calibration");
    return {
      kind: "ok",
      message: `新增 ${summary.created} / 更新 ${summary.updated}；自动匹配 ${summary.matched}、待审 ${summary.pending}`,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "导入失败" };
  }
}
