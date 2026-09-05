import { handleImageProcessingEditPost } from "@/lib/ecom/image-processing-edit-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  return handleImageProcessingEditPost(req);
}
