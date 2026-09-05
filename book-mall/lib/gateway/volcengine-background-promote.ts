/**
 * @deprecated 火山专用入口；统一走 promoteVideoTasksToBackgroundGeneration。
 */
export { promoteVideoTasksToBackgroundGeneration as promoteVolcengineTasksToBackgroundGeneration } from "@/lib/gateway/video-background-promote";

/** @deprecated 改用 promoteVideoTasksToBackgroundGeneration */
export async function expireVolcengineGatewayPollStalledLogs(
  nowMs: number = Date.now(),
): Promise<number> {
  const { promoteVideoTasksToBackgroundGeneration } = await import(
    "@/lib/gateway/video-background-promote"
  );
  return promoteVideoTasksToBackgroundGeneration(nowMs);
}
