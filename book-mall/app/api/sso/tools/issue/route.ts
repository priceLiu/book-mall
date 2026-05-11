import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueToolsSsoRedirect } from "@/lib/issue-tools-sso-redirect";

/**
 * 主站侧：黄金会员或管理员换取跳转 URL（query 带一次性 code）。
 * 工具站 `/auth/sso/callback` 应用服务端 POST `/api/sso/tools/exchange` 换 token。
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let redirectPath = "/fitting-room";
  try {
    const body = await req.json();
    if (typeof body?.redirectPath === "string") {
      const rp = body.redirectPath.trim();
      if (rp.startsWith("/") && !rp.startsWith("//")) redirectPath = rp;
    }
  } catch {
    /* ignore body */
  }

  const result = await issueToolsSsoRedirect({
    userId: session.user.id,
    redirectPath,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({
    redirectUrl: result.redirectUrl,
    codeTtlSeconds: result.codeTtlSeconds,
  });
}
