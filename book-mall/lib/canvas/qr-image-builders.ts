import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import { resolveQrTextToImageGatewayModelKey } from "@/lib/quick-replica/qr-text-to-image-models";

export function buildQrTextToImageCreateArgs(args: {
  modelKey: string;
  prompt: string;
  imageUrls?: string[];
  aspectRatio?: string;
  resolution?: string;
  mode?: string;
  outputFormat?: string;
}): { model: string; input: Record<string, unknown> } {
  const modelKey = resolveQrTextToImageGatewayModelKey(args.modelKey);
  const params: Record<string, unknown> = {
    aspect_ratio: args.aspectRatio?.trim() || "1:1",
  };

  if (args.resolution?.trim()) {
    params.resolution = args.resolution.trim();
  }

  const mode = args.mode?.trim();
  if (mode === "basic" || mode === "high" || mode === "medium") {
    params.quality = mode;
  }
  if (mode === "pro") {
    params.enable_pro = true;
  }

  if (args.outputFormat === "jpeg" || args.outputFormat === "png" || args.outputFormat === "webp") {
    params.output_format = args.outputFormat;
  }

  return buildKieImageCreateArgs({
    modelKey,
    prompt: args.prompt.trim(),
    imageUrls: args.imageUrls,
    params,
  });
}
