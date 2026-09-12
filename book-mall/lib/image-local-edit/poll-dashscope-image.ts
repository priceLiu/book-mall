import { ecomGwPollDashscope } from "@/lib/gateway/ecom-tool-gateway-client";

function isTransientPollError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("fetch failed") ||
    msg.includes("502") ||
    msg.includes("503")
  );
}

export async function pollDashscopeImageJob(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let polled: Awaited<ReturnType<typeof ecomGwPollDashscope>>;
    try {
      polled = await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
    } catch (e) {
      if (isTransientPollError(e) && i < 59) continue;
      throw e instanceof Error ? e : new Error(String(e));
    }
    if (polled.status === "SUCCEEDED" && polled.outputUrl) return polled.outputUrl;
    if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "生图任务失败");
  }
  throw new Error("生图超时，请稍后重试");
}
