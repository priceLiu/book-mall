import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { postToolUsageFromServerWithRetries } from "@/lib/forward-tools-usage-server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { getQwenApiKey } from "@/lib/qwen-env";
import { i2vGetVideoTask } from "@/lib/image-to-video-dashscope";
import { formatDashScopeI2vFailureForUser } from "@/lib/image-to-video-task-errors";

export const runtime = "nodejs";

/** 视频工具单次成功扣费：ToolBillablePrice `image-to-video` / `invoke`（产品侧展示 15 元/次，以主站定价为准）。幂等 meta.taskId */
export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("image-to-video");
  if (!suite.ok) return suite.response;

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

  const polled = await i2vGetVideoTask({ apiKey, taskId });
  if (!polled.ok) {
    return NextResponse.json({ error: polled.error }, { status: 502 });
  }

  const status = polled.output.task_status ?? "";
  if (status !== "SUCCEEDED") {
    const detail =
      status === "FAILED"
        ? formatDashScopeI2vFailureForUser(polled.output, status)
        : status || "UNKNOWN";
    return NextResponse.json(
      {
        error:
          status === "FAILED"
            ? `生成失败：${detail}`
            : `任务未完成，当前状态：${detail}`,
        taskStatus: status,
      },
      { status: 409 },
    );
  }

  const billTaskId = polled.output.task_id?.trim() || taskId;
  const videoUrl =
    typeof polled.output.video_url === "string"
      ? polled.output.video_url.trim()
      : "";

  let usage;
  try {
    usage = await postToolUsageFromServerWithRetries({
      toolKey: "image-to-video",
      action: "invoke",
      meta: { taskId: billTaskId, videoUrl },
    });
  } catch (e) {
    console.error("[image-to-video/settle] usage POST failed after retries", e);
    return NextResponse.json(
      {
        error:
          "计费上报暂时不可用（网络异常）。视频已生成；请稍后在费用明细核对或重试计费。",
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
