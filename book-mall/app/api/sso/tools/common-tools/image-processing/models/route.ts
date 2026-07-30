import { handleImageProcessingModelsGet } from "@/lib/ecom/image-processing-models-handler";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleImageProcessingModelsGet(req);
}
