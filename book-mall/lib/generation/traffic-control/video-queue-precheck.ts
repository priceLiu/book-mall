/**
 * Phase E：交通控流入队前轻量积分预检（只读余额，不 RESERVE）。
 * 积分真不足时直接失败，不占 QUEUED 槽 / dispatch 连接。
 */
import { assertCreditsBeforeGenerate } from "@/lib/billing/credit-pre-check";
import { InsufficientCreditsError } from "@/lib/billing/credit-account-service";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { isTrafficControlEnabled } from "@/lib/generation/traffic-control/constants";
import { resolveCanvasProjectTrafficScope } from "@/lib/generation/traffic-control/scope-key";

export async function assertVideoCreditsBeforeTrafficQueue(input: {
  userId: string;
  projectId: string;
  model: string;
  params?: Record<string, unknown>;
  /** 跳过预检（如 TRAFFIC_CONTROL_OFF 同步路径） */
  skip?: boolean;
}): Promise<void> {
  if (input.skip || !isTrafficControlEnabled()) return;

  const auth = await resolveGatewayAuthForBookUser(input.userId);
  if (!auth) return;

  const scope = await resolveCanvasProjectTrafficScope(input.projectId, input.userId);
  const inputSummary = buildGatewayInputSummary(input.model, {
    prompt: "",
    ...(input.params ?? {}),
    duration: Number(input.params?.duration ?? 5),
    resolution: String(input.params?.resolution ?? "1080p"),
  });

  try {
    await assertCreditsBeforeGenerate({
      tenantId: scope.tenantId,
      actorBookUserId: input.userId,
      apiKeyId: auth.id,
      model: input.model,
      requestKind: "VIDEO",
      inputSummary,
    });
  } catch (e) {
    if (e instanceof InsufficientCreditsError) {
      throw new CanvasProjectError("INSUFFICIENT_CREDITS", e.message, 402);
    }
    throw e;
  }
}
