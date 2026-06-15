import { NextResponse } from "next/server";

import { requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { verifyToolsAccessToken } from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

/**
 * 旧钱包按次扣点已退役。扣费统一在 Gateway `createRequestLog` / `finalizeRequestLog`。
 * 保留 POST 以兼容历史客户端（e-commerce-toolkit reserve/settle 等），恒 no-op。
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
