import { ECOM_OUTFIT_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-outfit-video-types";
import type { VtonGarmentMode, VtonLookKind } from "@/lib/ecom/ecom-vton/types";
import { runEcomVtonTryOn } from "@/lib/ecom/ecom-vton/tryon";

export async function runEcomOutfitVideoTryOn(opts: {
  userId: string;
  projectId: string;
  personImageUrl: string;
  garmentMode: VtonGarmentMode;
  topGarmentUrl: string;
  bottomGarmentUrl?: string;
  onProgress?: Parameters<typeof runEcomVtonTryOn>[0]["onProgress"];
}): Promise<string> {
  const lookKind: VtonLookKind =
    opts.garmentMode === "two_piece" ? "two_piece" : "one_piece";
  return runEcomVtonTryOn({
    userId: opts.userId,
    projectId: opts.projectId,
    consumerToolKey: ECOM_OUTFIT_VIDEO_TOOL_KEY,
    personImageUrl: opts.personImageUrl,
    lookKind,
    topGarmentUrl: opts.topGarmentUrl,
    bottomGarmentUrl: opts.bottomGarmentUrl,
    onProgress: opts.onProgress,
  });
}
