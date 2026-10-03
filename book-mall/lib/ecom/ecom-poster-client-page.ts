import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_POSTER_TOOL_KEY } from "@/lib/ecom/ecom-poster-types";

export type PosterGatewayAction = "generate" | "batch-generate" | "auto-plan" | "compose";

export function posterGatewayClientPage(
  userId: string,
  projectId: string,
  action: PosterGatewayAction,
): string {
  return ecomClientPage(userId, projectId, `${ECOM_POSTER_TOOL_KEY}__${action}`);
}
