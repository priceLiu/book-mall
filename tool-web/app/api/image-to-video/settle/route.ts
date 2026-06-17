import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { serviceFeeSettleJson, TOOL_SERVICE_FEE_MODE } from "@/lib/tool-service-fee-mode";
import { pollDashscopeJobFromServer } from "@/lib/forward-gateway-dashscope-server";
import { pollKieJobFromServer } from "@/lib/forward-gateway-kie-server";
import type { I2vTaskOutput } from "@/lib/image-to-video-dashscope";
import { formatDashScopeI2vFailureForUser } from "@/lib/image-to-video-task-errors";

export const runtime = "nodejs";

/** 视频结算：扣费由 Gateway 积分结算；本路由仅校验任务成功。 */
export async function POST(req: Request) {
  const suite = await requireToolSuiteNavAccess("image-to-video");
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

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  if (!taskId) {
    return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
  }

  const gatewayLogId =
    typeof body.gatewayLogId === "string" && body.gatewayLogId.trim().length > 0
      ? body.gatewayLogId.trim()
      : undefined;
  const provider =
    typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";

  const polled =
    provider === "kie"
      ? await pollKieJobFromServer({ taskId, gatewayLogId })
      : await pollDashscopeJobFromServer({ taskId, gatewayLogId });
  if (!polled.ok) {
    return NextResponse.json({ error: polled.error }, { status: polled.status ?? 502 });
  }

  const output = polled.output as I2vTaskOutput;
  const status = output.task_status ?? "";
  if (status !== "SUCCEEDED") {
    const detail =
      status === "FAILED"
        ? formatDashScopeI2vFailureForUser(output, status)
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

  if (TOOL_SERVICE_FEE_MODE) {
    return NextResponse.json(serviceFeeSettleJson());
  }

  return NextResponse.json({ ok: true, recorded: false, creditBilling: true });
}
