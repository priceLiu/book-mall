import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

const MAX_TOOL_KEY = 64;
const MAX_ACTION = 64;
const MAX_USAGE_QUERY = 100;

function parseMeta(v: unknown): Prisma.InputJsonValue | undefined {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return undefined;
  return v as Prisma.InputJsonValue;
}

function verifyBearer(req: Request):
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse } {
  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 }),
    };
  }
  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return {
      ok: false,
      res: NextResponse.json({ error: "缺少 Bearer Token" }, { status: 401 }),
    };
  }
  const verified = verifyToolsAccessToken(raw, jwtSecret);
  if (!verified) {
    return {
      ok: false,
      res: NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 }),
    };
  }
  return { ok: true, userId: verified.sub };
}

async function resolveCostMinorForEvent(
  body: Record<string, unknown>,
  toolKey: string,
  action: string,
): Promise<number | undefined> {
  const raw = body.costMinor;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  if (
    action === "try_on" &&
    (toolKey.includes("ai-fit") || toolKey.endsWith("__ai-fit"))
  ) {
    const cfg = await prisma.platformConfig.findUnique({
      where: { id: "default" },
      select: { toolInvokePerCallMinor: true },
    });
    const v = cfg?.toolInvokePerCallMinor;
    if (typeof v === "number" && v > 0) return v;
  }
  return undefined;
}

/** 当前用户在工具站产生的使用明细（分页由 limit 控制）。 */
export async function GET(req: Request) {
  const v = verifyBearer(req);
  if (!v.ok) return v.res;

  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(
    MAX_USAGE_QUERY,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50),
  );
  const toolKeyPrefix = url.searchParams.get("toolKeyPrefix")?.trim() ?? "";

  const events = await prisma.toolUsageEvent.findMany({
    where: {
      userId: v.userId,
      ...(toolKeyPrefix.length > 0
        ? { toolKey: { startsWith: toolKeyPrefix } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      toolKey: true,
      action: true,
      meta: true,
      costMinor: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ events });
}

/**
 * 记录工具站使用事件（需在请求头携带工具 JWT）。
 * 身份以验签后的 `sub` 为准，对应主站 User.id；不写 introspect，避免拖慢打点。
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
  const toolKey =
    toolKeyRaw.length > 0 ? toolKeyRaw.slice(0, MAX_TOOL_KEY) : "";
  if (!toolKey) {
    return NextResponse.json({ error: "toolKey 必填" }, { status: 400 });
  }

  const actionRaw =
    typeof body.action === "string" && body.action.trim().length > 0
      ? body.action.trim().slice(0, MAX_ACTION)
      : "page_view";

  const meta = parseMeta(body.meta);
  const costMinor = await resolveCostMinorForEvent(body, toolKey, actionRaw);

  try {
    await prisma.toolUsageEvent.create({
      data: {
        userId: verified.sub,
        toolKey,
        action: actionRaw,
        ...(costMinor !== undefined ? { costMinor } : {}),
        ...(meta !== undefined ? { meta } : {}),
      },
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

  return NextResponse.json({ ok: true });
}
