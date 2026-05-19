import { NextResponse } from "next/server";
import { releaseWalletHoldFromServer } from "@/lib/forward-tools-usage-server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";

export const runtime = "nodejs";

/** v003：生成失败/取消时由前端调用，释放 reserve 的钱包 hold。幂等。 */
export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("image-to-video");
  if (!suite.ok) return suite.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const holdId =
    typeof body.holdId === "string" && body.holdId.trim().length > 0
      ? body.holdId.trim()
      : undefined;
  const taskKey =
    typeof body.taskKey === "string" && body.taskKey.trim().length > 0
      ? body.taskKey.trim()
      : undefined;
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 200)
      : undefined;

  if (!holdId && !taskKey) {
    return NextResponse.json({ error: "需提供 holdId 或 taskKey" }, { status: 400 });
  }

  const r = await releaseWalletHoldFromServer({ holdId, taskKey, reason });
  if (!r.ok) {
    return NextResponse.json({ error: "release_failed" }, { status: 502 });
  }
  return NextResponse.json(r.data ?? { ok: true }, { status: r.status ?? 200 });
}
