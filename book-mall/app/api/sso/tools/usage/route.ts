import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBillableSnapshot, type BillableSnapshot } from "@/lib/tool-billable-price";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { recordToolUsageAndConsumeWallet } from "@/lib/wallet-record-tool-usage-consume";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import { reserveWalletHold, releaseWalletHold } from "@/lib/wallet-holds";
import { isEcomToolkitToolKey } from "@/lib/ecom/ecom-tool-keys";
import { shouldMeterEcomToolkitUsage } from "@/lib/ecom/ecom-billing-mode";
import { isServiceFeeMeteredToolKey } from "@/lib/tool-service-fee/config";
import { isUnifiedCreditBillingActive } from "@/lib/billing/unified-credit-flag";

export const dynamic = "force-dynamic";

const MAX_TOOL_KEY = 64;
const MAX_ACTION = 64;
/** 工具站费用明细分页：每页最多条数（产品约定 50） */
const DEFAULT_USAGE_LIMIT = 50;
const MAX_USAGE_LIMIT = 50;

function parseMeta(v: unknown): Prisma.InputJsonValue | undefined {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return undefined;
  return v as Prisma.InputJsonValue;
}

/**
 * 从 settle/usage body.meta 抽取模型 key（用于 ToolBillablePrice 查找）。
 * 兼容历史几个 meta 字段名：`modelId / apiModel / videoModel / textToImageModel / tryOnModel`。
 * 注意：本路由不再接受 `body.costPoints`（v002 清理）；定价完全由服务端 `ToolBillablePrice` 决定。
 */
function schemeARefModelFromUsageBody(body: Record<string, unknown>): string | undefined {
  const raw = body.meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const keys = ["modelId", "apiModel", "videoModel", "textToImageModel", "tryOnModel"] as const;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/**
 * v003：从上报 meta 抽取"实际用量"传给 `resolveBillableSnapshot.actuals`。
 * - videoDurationSec：图生/文生视频 settle 已带（lib/forward-tools-usage-server.ts）
 * - imageCount：文生图 settle 可带（兼容旧字段 `imageNum` / `n`）
 * - inputTokens / outputTokens：LLM/分析室 settle 可带（兼容旧字段 `inputTokensUsed` 等）
 */
function actualsFromUsageBody(body: Record<string, unknown>):
  | {
      durationSec?: number;
      imageCount?: number;
      inputTokens?: number;
      outputTokens?: number;
      videoSr?: number | string;
      videoAudio?: boolean;
    }
  | undefined {
  const raw = body.meta;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const num = (v: unknown): number | undefined => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const dur = num(m.videoDurationSec) ?? num(m.durationSec);
  const imageCount =
    num(m.imageCount) ?? num(m.imageNum) ?? num(m.n) ?? num(m.generatedImageCount);
  const inputTokens = num(m.inputTokens) ?? num(m.inputTokensUsed) ?? num(m.promptTokens);
  const outputTokens = num(m.outputTokens) ?? num(m.outputTokensUsed) ?? num(m.completionTokens);
  /** v004：视频档位（720/1080/360 等）从 settle meta.videoSr 透传，让主站按 cloudTierRaw 选行 */
  const videoSrRaw =
    typeof m.videoSr === "number" || typeof m.videoSr === "string" ? m.videoSr : undefined;
  /** v004：是否带音频（wan2.6-flash 系列按 audio 维度区分单价；其余视频模型忽略） */
  const videoAudio =
    typeof m.videoAudio === "boolean" ? m.videoAudio : undefined;
  if (
    dur == null &&
    imageCount == null &&
    inputTokens == null &&
    outputTokens == null &&
    videoSrRaw == null &&
    videoAudio == null
  ) {
    return undefined;
  }
  return {
    ...(dur != null ? { durationSec: dur } : {}),
    ...(imageCount != null ? { imageCount } : {}),
    ...(inputTokens != null ? { inputTokens } : {}),
    ...(outputTokens != null ? { outputTokens } : {}),
    ...(videoSrRaw != null ? { videoSr: videoSrRaw } : {}),
    ...(videoAudio != null ? { videoAudio } : {}),
  };
}

type CostResolution = {
  costPoints: number;
  snapshot: BillableSnapshot;
};

/**
 * v002（清理后）：只信服务端 `ToolBillablePrice` 给出的 `points`；
 * 客户端再也不能传 `costPoints` 来"自定价"。命中行不存在则返回 undefined → 不入库（recorded:false）。
 *
 * 唯一旧逻辑退路（保留）：`fitting-room__ai-fit / try_on` 在没有 ToolBillablePrice 命中时回退到
 * `PlatformConfig.toolInvokePerCallPoints`（产品配置面板单价），保证试衣不漏扣。
 */
async function resolveCostAndSnapshotForEvent(
  body: Record<string, unknown>,
  toolKey: string,
  action: string,
  userId: string,
): Promise<CostResolution | undefined> {
  const actuals = actualsFromUsageBody(body);
  const snap = await resolveBillableSnapshot(toolKey, action, {
    userId,
    schemeARefModelKey: schemeARefModelFromUsageBody(body),
    actuals:
      actuals ??
      (action === "try_on" && toolKey === "fitting-room__ai-fit"
        ? { imageCount: 1 }
        : undefined),
  });
  if (snap && snap.points > 0) {
    return { costPoints: snap.points, snapshot: snap };
  }

  if (action === "try_on" && toolKey === "fitting-room__ai-fit") {
    const cfg = await prisma.platformConfig.findUnique({
      where: { id: "default" },
      select: { toolInvokePerCallPoints: true },
    });
    const v = cfg?.toolInvokePerCallPoints;
    if (typeof v === "number" && v > 0 && snap) {
      return { costPoints: v, snapshot: snap };
    }
  }
  return undefined;
}

/** 当前用户在工具站产生的使用明细（分页：`page` + `limit`，默认每页 50 条）。 */
export async function GET(req: Request) {
  const v = verifyToolsBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? `${DEFAULT_USAGE_LIMIT}`, 10);
  const limit = Math.min(
    MAX_USAGE_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_USAGE_LIMIT),
  );
  const pageRaw = parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const skip = (page - 1) * limit;
  const toolKeyPrefix = url.searchParams.get("toolKeyPrefix")?.trim() ?? "";

  const baseWhere: Prisma.ToolUsageEventWhereInput = {
    userId: v.userId,
    ...(toolKeyPrefix.length > 0
      ? { toolKey: { startsWith: toolKeyPrefix } }
      : {}),
  };

  const [total, events, summaryGroups] = await prisma.$transaction([
    prisma.toolUsageEvent.count({ where: baseWhere }),
    prisma.toolUsageEvent.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        toolKey: true,
        action: true,
        meta: true,
        costPoints: true,
        createdAt: true,
      },
    }),
    prisma.toolUsageEvent.groupBy({
      by: ["toolKey"],
      where: baseWhere,
      orderBy: { toolKey: "asc" },
      _count: { id: true },
      _sum: { costPoints: true },
    }),
  ]);

  const totalPages =
    total === 0 ? 0 : Math.ceil(total / limit);

  const summaryByTool = [...summaryGroups]
    .map((r) => ({
      toolKey: r.toolKey,
      label: toolKeyToLabel(r.toolKey),
      billCount: (r._count as { id: number } | undefined)?.id ?? 0,
      sumPoints: (r._sum as { costPoints: number | null } | undefined)?.costPoints ?? 0,
    }))
    .sort(
      (a, b) =>
        b.sumPoints - a.sumPoints ||
        b.billCount - a.billCount ||
        a.label.localeCompare(b.label, "zh-CN"),
    );

  return NextResponse.json({
    events,
    page,
    limit,
    total,
    totalPages,
    summaryByTool,
  });
}

/**
 * v003 reserve：基于 body.estimatedMaxPoints 写一条 HELD 的 WalletHold。
 * 必填：toolKey、estimatedMaxPoints；推荐：taskKey、action、meta（estimated durationSec/modelKey 等）。
 * 返回 201 { holdId, reservedPoints, expiresAt, reused }；余额不足或低于水位线 → 402。
 */
async function handleReserve(_req: Request, userId: string, body: Record<string, unknown>): Promise<Response> {
  const toolKey =
    typeof body.toolKey === "string" && body.toolKey.trim().length > 0
      ? body.toolKey.trim().slice(0, MAX_TOOL_KEY)
      : "";
  if (!toolKey) {
    return NextResponse.json({ error: "reserve: toolKey 必填" }, { status: 400 });
  }
  if (
    isEcomToolkitToolKey(toolKey) &&
    !(await shouldMeterEcomToolkitUsage(userId, toolKey))
  ) {
    return NextResponse.json(
      {
        ok: true,
        holdId: null,
        reservedPoints: 0,
        reused: false,
        serviceFeeMode: true,
      },
      { status: 201 },
    );
  }
  if (isServiceFeeMeteredToolKey(toolKey)) {
    return NextResponse.json(
      {
        ok: true,
        holdId: null,
        reservedPoints: 0,
        reused: false,
        serviceFeeMode: true,
      },
      { status: 201 },
    );
  }
  const action =
    typeof body.action === "string" && body.action.trim().length > 0
      ? body.action.trim().slice(0, MAX_ACTION)
      : null;
  const estimated =
    typeof body.estimatedMaxPoints === "number"
      ? body.estimatedMaxPoints
      : typeof body.estimatedMaxPoints === "string"
        ? Number(body.estimatedMaxPoints)
        : NaN;
  if (!Number.isFinite(estimated) || estimated <= 0) {
    return NextResponse.json(
      { error: "reserve: estimatedMaxPoints 必须为正数（预估上限点数）" },
      { status: 400 },
    );
  }
  const taskKey =
    typeof body.taskKey === "string" && body.taskKey.trim().length > 0
      ? body.taskKey.trim()
      : null;
  const meta = parseMeta(body.meta) ?? null;

  const result = await reserveWalletHold({
    userId,
    toolKey,
    action,
    estimatedMaxPoints: estimated,
    taskKey,
    meta,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason === "below_watermark" ? "below_watermark" : "insufficient_balance",
        balancePoints: result.balancePoints,
        heldPoints: result.heldPoints,
        requiredPoints: result.requiredPoints,
        ...(result.reason === "below_watermark"
          ? { watermarkPoints: result.watermarkPoints, gate: "watermark" }
          : { gate: "balance" }),
      },
      { status: 402 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      holdId: result.holdId,
      reservedPoints: result.reservedPoints,
      expiresAt: result.expiresAt.toISOString(),
      reused: result.reused,
    },
    { status: 201 },
  );
}

/**
 * v003 release：把 HELD 状态的 WalletHold 转 RELEASED（失败/取消时调用，幂等）。
 * 至少一项：body.holdId 或 (body.taskKey)；后者从 verified.sub 派生 userId 联查。
 */
async function handleRelease(userId: string, body: Record<string, unknown>): Promise<Response> {
  const holdId =
    typeof body.holdId === "string" && body.holdId.trim().length > 0
      ? body.holdId.trim()
      : undefined;
  const taskKey =
    typeof body.taskKey === "string" && body.taskKey.trim().length > 0
      ? body.taskKey.trim()
      : undefined;
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 200)
      : undefined;

  if (!holdId && !taskKey) {
    return NextResponse.json(
      { error: "release: 需提供 holdId 或 taskKey 其中之一" },
      { status: 400 },
    );
  }

  const r = await releaseWalletHold({
    holdId,
    userId: holdId ? undefined : userId,
    taskKey: holdId ? undefined : taskKey,
    reason,
  });
  if (!r.ok) {
    if (r.reason === "not_found") {
      return NextResponse.json({ error: "hold_not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "already_settled" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, holdId: r.holdId, alreadyReleased: r.alreadyReleased ?? false });
}

/**
 * 工具站上报入口（需在请求头携带工具 JWT）。
 *
 * v003：支持三段式 phase（query 或 body 任一指定）
 *   - 无 phase / phase=auto：旧路径——直接计算 chargePoints 并扣费（自然修正按秒计费）
 *   - phase=reserve：预占用——按 body.estimatedMaxPoints 申请 WalletHold（HELD），返回 holdId
 *   - phase=settle：结算——传 body.holdId（可选），按 meta 中实际用量算 chargePoints，扣费并 hold SETTLED
 *   - phase=release：释放——传 body.holdId 或 body.taskKey，把 hold RELEASED（失败/取消）
 *
 * 仅当解析出的 costPoints 为正整数时写入 ToolUsageEvent；否则返回 { ok: true, recorded: false }。
 */
export async function POST(req: Request) {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 });
  }

  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const url = new URL(req.url);
  const phaseRaw =
    (typeof body.phase === "string" ? body.phase.trim() : "") ||
    (url.searchParams.get("phase") ?? "").trim();
  const phase = phaseRaw || "auto";

  // 统一积分计费激活：旧钱包扣点收敛为 no-op（互斥避免双扣）。
  // 实际扣费在 Gateway finalize 按积分结算；此处仅放行工具站调用链。
  if (isUnifiedCreditBillingActive()) {
    if (phase === "reserve") {
      return NextResponse.json(
        { ok: true, holdId: null, reservedPoints: 0, reused: false, creditBilling: true },
        { status: 201 },
      );
    }
    if (phase === "release") {
      return NextResponse.json({ ok: true, creditBilling: true });
    }
    return NextResponse.json({ ok: true, recorded: false, creditBilling: true });
  }

  // reserve / release 不要求 toolKey 之外的字段，单独走分支处理。
  if (phase === "reserve") {
    return handleReserve(req, verified.sub, body);
  }
  if (phase === "release") {
    return handleRelease(verified.sub, body);
  }

  const toolKeyRaw = typeof body.toolKey === "string" ? body.toolKey.trim() : "";
  const rawToolKey =
    toolKeyRaw.length > 0 ? toolKeyRaw.slice(0, MAX_TOOL_KEY) : "";
  if (!rawToolKey) {
    return NextResponse.json({ error: "toolKey 必填" }, { status: 400 });
  }
  if (
    isEcomToolkitToolKey(rawToolKey) &&
    !(await shouldMeterEcomToolkitUsage(verified.sub, rawToolKey))
  ) {
    return NextResponse.json({
      ok: true,
      recorded: false,
      serviceFeeMode: true,
    });
  }
  if (isServiceFeeMeteredToolKey(rawToolKey)) {
    return NextResponse.json({
      ok: true,
      recorded: false,
      serviceFeeMode: true,
    });
  }

  const actionRaw =
    typeof body.action === "string" && body.action.trim().length > 0
      ? body.action.trim().slice(0, MAX_ACTION)
      : "page_view";

  const meta = parseMeta(body.meta);
  const resolution = await resolveCostAndSnapshotForEvent(
    body,
    rawToolKey,
    actionRaw,
    verified.sub,
  );

  /** 仅入库「已标价且金额 > 0」的流水；浏览与非计费动作不入库（见 tool-web/doc/payment.md）。 */
  if (!resolution || resolution.costPoints <= 0) {
    return NextResponse.json({ ok: true, recorded: false });
  }
  const costPoints = resolution.costPoints;
  const snap = resolution.snapshot;
  try {
    // v003：phase=settle 时可带 body.holdId，settle 内会把对应 WalletHold 转 SETTLED。
    const holdIdInBody =
      typeof body.holdId === "string" && body.holdId.trim().length > 0
        ? body.holdId.trim()
        : null;

    const outcome = await recordToolUsageAndConsumeWallet({
      userId: verified.sub,
      toolKey: rawToolKey,
      action: actionRaw,
      costPoints,
      meta,
      pricingSnapshot: {
        unitCostYuan: snap.unitCostYuan,
        retailMultiplier: snap.retailMultiplier,
        ourUnitYuan: snap.ourUnitYuan,
        schemeARefModelKey: snap.schemeARefModelKey,
        billablePriceId: snap.billablePriceId,
        // v007 Round 5 hotfix-4：上一版漏传 → 下游 fallback 到"元/次 × 次"。
        // 现在透传 cloudBillingKind + 实际计费用量/单位，让 cloudRow 公式正确显示为"元/张 × N 张"。
        cloudBillingKind: snap.billingKind ?? null,
        billedQty:
          snap.billedImageCount ??
          snap.billedVideoSec ??
          null,
        billedUnit:
          snap.billingKind === "VIDEO_MODEL_SPEC"
            ? "秒"
            : snap.billingKind === "OUTPUT_IMAGE" ||
                snap.billingKind === "COST_PER_IMAGE"
              ? "张"
              : snap.billingKind === "TOKEN_IN_OUT"
                ? "千tokens"
                : null,
      },
      billedVideoSec: snap.billedVideoSec,
      walletHoldId: phase === "settle" ? holdIdInBody : null,
    });

    if (!outcome.ok) {
      if (outcome.reason === "duplicate") {
        return NextResponse.json({
          ok: true,
          recorded: false,
          duplicate: true,
          costPoints,
        });
      }
      return NextResponse.json(
        {
          error: "insufficient_balance",
          balancePoints: outcome.balancePoints,
          requiredPoints: costPoints,
          watermarkPoints: outcome.watermarkPoints ?? null,
          gate: outcome.gate ?? "balance",
        },
        { status: 402 },
      );
    }

    return NextResponse.json({
      ok: true,
      recorded: true,
      balancePoints: outcome.balanceAfterPoints,
      costPoints,
    });
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: unknown }).code)
        : "";
    if (code === "P2003") {
      return NextResponse.json(
        { error: "用户不存在或已被删除，无法记录" },
        { status: 404 },
      );
    }
    throw e;
  }
}
