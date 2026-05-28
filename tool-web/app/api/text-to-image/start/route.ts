import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { createDashscopeJobFromServer } from "@/lib/forward-gateway-dashscope-server";
import { WANX_TEXT2IMAGE_PLUS_MODEL } from "@/lib/text-to-image-dashscope";

export const runtime = "nodejs";

const MAX_PROMPT = 800;

export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("text-to-image");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
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

  const created = await createDashscopeJobFromServer({
    kind: "wanx",
    model: WANX_TEXT2IMAGE_PLUS_MODEL,
    prompt,
    negativePrompt,
    n,
    clientPage: "text-to-image",
  });

  if (!created.ok) {
    return NextResponse.json(
      { error: created.error ?? "Gateway 调用失败", code: created.status === 403 ? "GATEWAY_KEY_REQUIRED" : undefined },
      { status: created.status ?? 502 },
    );
  }

  return NextResponse.json({
    taskId: created.taskId,
    gatewayLogId: created.logId,
    holdId: null,
  });
}
