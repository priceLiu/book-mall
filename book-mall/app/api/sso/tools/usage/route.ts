import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBillableSnapshot, type BillableSnapshot } from "@/lib/tool-billable-price";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { recordToolUsageAndConsumeWallet } from "@/lib/wallet-record-tool-usage-consume";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

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
): Promise<CostResolution | undefined> {
  const snap = await resolveBillableSnapshot(toolKey, action, {
    schemeARefModelKey: schemeARefModelFromUsageBody(body),
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
 * 工具站上报入口（需在请求头携带工具 JWT）。
 * 仅当解析出的 costPoints 为正整数时写入 ToolUsageEvent；否则返回 { ok: true, recorded: false }，不落库。
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

  const toolKeyRaw = typeof body.toolKey === "string" ? body.toolKey.trim() : "";
  const rawToolKey =
    toolKeyRaw.length > 0 ? toolKeyRaw.slice(0, MAX_TOOL_KEY) : "";
  if (!rawToolKey) {
    return NextResponse.json({ error: "toolKey 必填" }, { status: 400 });
  }

  const actionRaw =
    typeof body.action === "string" && body.action.trim().length > 0
      ? body.action.trim().slice(0, MAX_ACTION)
      : "page_view";

  const meta = parseMeta(body.meta);
  const resolution = await resolveCostAndSnapshotForEvent(body, rawToolKey, actionRaw);

  /** 仅入库「已标价且金额 > 0」的流水；浏览与非计费动作不入库（见 tool-web/doc/payment.md）。 */
  if (!resolution || resolution.costPoints <= 0) {
    return NextResponse.json({ ok: true, recorded: false });
  }
  const costPoints = resolution.costPoints;
  const snap = resolution.snapshot;
  try {
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
      },
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
