import { NextResponse } from "next/server";
import { verifyPublisherJobTicket } from "@/lib/publisher/publisher-job-ticket";
import { withApiDbGuard } from "@/lib/http/api-db-error";

export const dynamic = "force-dynamic";

/** POST { jobTicket } → 校验短时票据（扩展 / 桌面调用，无需登录） */
export const POST = withApiDbGuard(async (req) => {
  let jobTicket = "";
  try {
    const body = (await req.json()) as { jobTicket?: string };
    jobTicket = body?.jobTicket?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  if (!jobTicket) {
    return NextResponse.json({ error: "缺少 jobTicket" }, { status: 400 });
  }

  const verified = verifyPublisherJobTicket(jobTicket);
  if (!verified) {
    return NextResponse.json({ error: "无效或过期的 jobTicket" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...verified });
});
