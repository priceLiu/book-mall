import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { postToolUsageFromServerWithRetries } from "@/lib/forward-tools-usage-server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getQwenApiKey } from "@/lib/qwen-env";
import { wanxGetTextImageTask } from "@/lib/text-to-image-dashscope";

export const runtime = "nodejs";

/** 文生图单次生成扣费（与 ToolBillablePrice text-to-image / invoke 对齐，默认 0.5 元）。幂等键 meta.taskId = DashScope task_id */
export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("text-to-image");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const apiKey = getQwenApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "服务端未配置 QWEN_API_KEY 或 DASHSCOPE_API_KEY" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  if (!taskId) {
    return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
  }

  const polled = await wanxGetTextImageTask({ apiKey, taskId });
  if (!polled.ok) {
    return NextResponse.json({ error: polled.error }, { status: 502 });
  }

  const status = polled.output.task_status ?? "";
  if (status !== "SUCCEEDED") {
    return NextResponse.json(
      {
        error: `任务未完成，当前状态：${status || "UNKNOWN"}`,
        taskStatus: status,
      },
      { status: 409 },
    );
  }

  const billTaskId = polled.output.task_id?.trim() || taskId;

  let usage;
  try {
    usage = await postToolUsageFromServerWithRetries({
      toolKey: "text-to-image",
      action: "invoke",
      meta: { taskId: billTaskId },
    });
  } catch (e) {
    console.error("[text-to-image/settle] usage POST failed after retries", e);
    return NextResponse.json(
      {
        error:
          "计费上报暂时不可用（网络异常）。图片已生成；请稍后刷新费用明细核对是否记账，或在弹层内点击「重试计费」。",
      },
      { status: 503 },
    );
  }

  if (!usage.ok) {
    const msg =
      usage.reason === "no_session"
        ? "请先登录工具站"
        : "工具站未配置 MAIN_SITE_ORIGIN，无法计费";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  return NextResponse.json(usage.data, { status: usage.status });
}
