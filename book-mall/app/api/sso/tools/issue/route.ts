import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueToolsSsoRedirect } from "@/lib/issue-tools-sso-redirect";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

/** 主站侧：换取跳转 URL（query 带一次性 code）。 */
export const POST = withApiDbGuard(async (req) => {
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
});
