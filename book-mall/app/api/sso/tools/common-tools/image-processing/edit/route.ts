import { handleImageProcessingEditPost } from "@/lib/ecom/image-processing-edit-handler";
import { imageProcessingRequestContext } from "@/lib/ecom/image-processing-request-context";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  return imageProcessingRequestContext.run({ clientApp: "common-tools" }, () =>
    handleImageProcessingEditPost(req),
  );
}
