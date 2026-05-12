import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQwenApiKey } from "@/lib/qwen-env";
import { wanxGetTextImageTask } from "@/lib/text-to-image-dashscope";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const apiKey = getQwenApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端未配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY" },
      { status: 503 },
    );
  }

  const taskId = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!taskId) {
    return NextResponse.json({ error: "缺少任务 id" }, { status: 400 });
  }

  const polled = await wanxGetTextImageTask({ apiKey, taskId });
  if (!polled.ok) {
    return NextResponse.json({ error: polled.error }, { status: 502 });
  }

  return NextResponse.json({ output: polled.output, raw: polled.raw });
}
