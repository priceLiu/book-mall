import { NextResponse } from "next/server";
import { refreshClientSession } from "@/lib/client-device-service";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

/** 凭 refresh_token 续签 access_token（90 天滑动续期）。 */
export const POST = withApiDbGuard(async (req) => {
  let refreshToken = "";
  try {
    const body = (await req.json()) as { refresh_token?: string };
    refreshToken = body?.refresh_token?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  if (!refreshToken) {
    return NextResponse.json({ error: "缺少 refresh_token" }, { status: 400 });
  }

  const result = await refreshClientSession(refreshToken);
  // 成功分支没有 ok 字段，判存在即可收窄；再加 === false 会让收窄失效
  if ("ok" in result) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    expires_in: result.expiresIn,
    device_id: result.deviceId,
    user_id: result.userId,
    token_type: "Bearer",
  });
});
