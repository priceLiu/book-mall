import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";
import { toolKeyToLabel } from "@/lib/tool-key-label";

export const dynamic = "force-dynamic";

const DEFAULT_USAGE_LIMIT = 50;
const MAX_USAGE_LIMIT = 50;

/** 当前用户在工具站产生的历史使用明细（分页；新扣费见 GatewayRequestLog / CreditLedger）。 */
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

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

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
    legacyWalletBilling: false,
    creditBilling: true,
  });
}

/**
 * 旧钱包按次扣点已退役。扣费统一在 Gateway `createRequestLog` / `finalizeRequestLog`。
 * 保留 POST 以兼容历史客户端调用链，恒返回 no-op。
 */
export async function POST(req: Request) {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const raw = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 });
  }

  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // 空 body 亦视为 no-op
  }

  const url = new URL(req.url);
  const phaseRaw =
    (typeof body.phase === "string" ? body.phase.trim() : "") ||
    (url.searchParams.get("phase") ?? "").trim();
  const phase = phaseRaw || "auto";

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
