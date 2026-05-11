import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

const MAX_TOOL_KEY = 64;
const MAX_ACTION = 64;

function parseMeta(v: unknown): Prisma.InputJsonValue | undefined {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return undefined;
  return v as Prisma.InputJsonValue;
}

/**
 * 记录工具站使用事件（需在请求头携带工具 JWT）。
 * 身份以验签后的 `sub` 为准，对应主站 User.id；不写 introspect，避免拖慢打点。
 * 后续「扣减余额」等应在独立接口中复核准入并走钱包事务。
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

  try {
    await prisma.toolUsageEvent.create({
      data: {
        userId: verified.sub,
        toolKey,
        action: actionRaw,
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
