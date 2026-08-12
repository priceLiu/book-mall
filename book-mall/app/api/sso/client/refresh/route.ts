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
  if ("ok" in result && result.ok === false) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
  }

  const session = result as Awaited<ReturnType<typeof refreshClientSession>> & {
    accessToken: string;
  };

  return NextResponse.json({
    ok: true,
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expires_in: session.expiresIn,
    device_id: session.deviceId,
    user_id: session.userId,
    token_type: "Bearer",
  });
});
