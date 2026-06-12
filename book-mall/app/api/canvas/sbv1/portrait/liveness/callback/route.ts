import { type NextRequest, NextResponse } from "next/server";
import { sbv1RecordPortraitLivenessCallback } from "@/lib/canvas/sbv1-portrait-liveness-service";

export const dynamic = "force-dynamic";

/**
 * 火山 H5 活体完成后的 CallbackURL（公网可访问）
 * query: resultCode, bytedToken, …
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const bytedToken =
    sp.get("bytedToken")?.trim() ||
    sp.get("BytedToken")?.trim() ||
    sp.get("byted_token")?.trim() ||
    "";
  const resultCode =
    sp.get("resultCode")?.trim() ||
    sp.get("ResultCode")?.trim() ||
    sp.get("result_code")?.trim() ||
    undefined;

  if (bytedToken) {
    sbv1RecordPortraitLivenessCallback(bytedToken, resultCode);
  }

  const ok = resultCode === "10000";
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${ok ? "真人认证成功" : "真人认证"}</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0f0f12; color:#eee; display:flex; min-height:100vh; align-items:center; justify-content:center; padding:24px; }
    .card { max-width:420px; text-align:center; border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:28px 24px; }
    h1 { font-size:20px; margin:0 0 8px; }
    p { font-size:14px; line-height:1.6; color:rgba(255,255,255,.65); margin:0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${ok ? "✓ 真人认证已完成" : "认证结果已提交"}</h1>
    <p>${ok ? "请返回分镜视频画布，系统将自动获取 GroupId。" : "请返回画布查看认证状态；若未成功请重新发起活体检测。"}</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
