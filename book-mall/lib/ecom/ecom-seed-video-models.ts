import type { GatewayProviderKind } from "@prisma/client";

import { BAILIAN_R2V_KNOWN_MODELS } from "@/lib/canvas/providers/bailian-r2v";
import type { EcomStoryboardGatewayModel } from "@/lib/gateway/ecom-storyboard-chat-models";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";

/** 注册表未同步时，仍保证百炼 R2V（含 wan2.7-r2v）出现在种草视频模型弹层 */
export function mergeSeedVideoGatewayVideoModels(
  rows: EcomStoryboardGatewayModel[],
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  if (!isGatewayProviderBound(boundKinds, "BAILIAN")) return rows;
  const seen = new Set(rows.map((r) => r.modelKey));
  const merged = [...rows];
  for (const m of BAILIAN_R2V_KNOWN_MODELS) {
    if (seen.has(m.modelKey)) continue;
    seen.add(m.modelKey);
    merged.push({
      modelKey: m.modelKey,
      displayName: m.displayName,
      description: m.description ?? "",
      role: "VIDEO",
      providerKind: "BAILIAN",
      credentialBound: true,
    });
  }
  return merged;
}
