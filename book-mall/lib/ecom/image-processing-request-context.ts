import { AsyncLocalStorage } from "async_hooks";

import { assertCommonToolsGatewayAccess } from "@/lib/common-tools/common-tools-gateway-auth";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  COMMON_TOOLS_IMAGE_PROCESSING_TOOL_KEY,
  ECOM_IMAGE_PROCESSING_TOOL_KEY,
} from "@/lib/ecom/ecom-image-processing-models";

export type ImageProcessingClientApp = "e-commerce" | "common-tools";

export type ImageProcessingRequestContext = {
  clientApp: ImageProcessingClientApp;
};

export const imageProcessingRequestContext =
  new AsyncLocalStorage<ImageProcessingRequestContext>();

export function getImageProcessingRequestContext(): ImageProcessingRequestContext {
  return (
    imageProcessingRequestContext.getStore() ?? { clientApp: "e-commerce" }
  );
}

export function runWithImageProcessingContext<T>(
  ctx: ImageProcessingRequestContext,
  fn: () => T,
): T {
  return imageProcessingRequestContext.run(ctx, fn);
}

export async function assertImageProcessingGatewayAccess(
  userId: string,
): Promise<void> {
  const { clientApp } = getImageProcessingRequestContext();
  if (clientApp === "common-tools") {
    await assertCommonToolsGatewayAccess(userId);
    return;
  }
  await assertEcomToolkitGatewayAccess(userId);
}

export function buildImageProcessingClientPage(
  userId: string,
  workspaceId: string,
  mode?: string,
): string {
  const { clientApp } = getImageProcessingRequestContext();
  if (clientApp === "common-tools") {
    const base = `common-tools/${userId}/${workspaceId}/${COMMON_TOOLS_IMAGE_PROCESSING_TOOL_KEY}`;
    return mode ? `${base}/${mode}` : base;
  }
  return `ecom/${userId}/${workspaceId}/${ECOM_IMAGE_PROCESSING_TOOL_KEY}`;
}
