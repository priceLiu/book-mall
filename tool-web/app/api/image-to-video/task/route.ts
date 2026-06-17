import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireToolSuiteNavAccess } from "@/lib/require-tools-api-access";
import { pollDashscopeJobFromServer } from "@/lib/forward-gateway-dashscope-server";
import { pollKieJobFromServer } from "@/lib/forward-gateway-kie-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const suite = await requireToolSuiteNavAccess("image-to-video");
  if (!suite.ok) return suite.response;

  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) {
    return NextResponse.json({ error: "请先登录工具站" }, { status: 401 });
  }

  const url = new URL(req.url);
  const taskId = url.searchParams.get("id")?.trim() ?? "";
  const gatewayLogId = url.searchParams.get("gatewayLogId")?.trim() || undefined;
  const provider = url.searchParams.get("provider")?.trim().toLowerCase();
  if (!taskId) {
    return NextResponse.json({ error: "缺少任务 id" }, { status: 400 });
  }

  const polled =
    provider === "kie"
      ? await pollKieJobFromServer({ taskId, gatewayLogId })
      : await pollDashscopeJobFromServer({ taskId, gatewayLogId });
  if (!polled.ok) {
    return NextResponse.json({ error: polled.error }, { status: polled.status ?? 502 });
  }

  return NextResponse.json({ output: polled.output, raw: polled.output });
}
