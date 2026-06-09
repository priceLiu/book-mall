import { NextResponse } from "next/server";
import { ecomGenerateImage } from "@/lib/ecom/ecom-generate";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const toolKey = typeof body.toolKey === "string" ? body.toolKey.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "generate";
  const ecomModule =
    typeof body.module === "string" ? body.module.trim() : "main-image";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!toolKey.startsWith("ecom-toolkit")) {
    return NextResponse.json({ error: "无效 toolKey" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
  }
  try {
    const result = await ecomGenerateImage({
      userId: auth.userId,
      toolKey,
      action,
      module: ecomModule,
      prompt,
    });
    return NextResponse.json({
      asset: result.asset,
      chargePoints: result.chargePoints,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    const status = message.includes("余额") ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
