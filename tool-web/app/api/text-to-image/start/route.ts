import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getQwenApiKey } from "@/lib/qwen-env";
import { wanxCreateTextToImageTask } from "@/lib/text-to-image-dashscope";

export const runtime = "nodejs";

const MAX_PROMPT = 800;

export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("text-to-image");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const apiKey = getQwenApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端未配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY，无法调用通义文生图" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT) : "";
  if (!prompt) {
    return NextResponse.json({ error: "请输入提示词" }, { status: 400 });
  }

  const negativePrompt =
    typeof body.negativePrompt === "string"
      ? body.negativePrompt.trim().slice(0, 500)
      : undefined;

  const nRaw = body.n;
  const n =
    typeof nRaw === "number" && Number.isFinite(nRaw)
      ? Math.floor(nRaw)
      : typeof nRaw === "string" && /^\d+$/.test(nRaw.trim())
        ? parseInt(nRaw.trim(), 10)
        : 4;

  const created = await wanxCreateTextToImageTask({
    apiKey,
    prompt,
    negativePrompt,
    n,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  return NextResponse.json({ taskId: created.taskId });
}
