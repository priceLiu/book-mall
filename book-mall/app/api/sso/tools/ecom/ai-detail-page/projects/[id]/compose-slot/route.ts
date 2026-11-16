import { ECOM_AI_DETAIL_PAGE_MODULE } from "@/lib/ecom/detail-page-suite/types";
import { handleDetailPageSuiteComposeSlotPost } from "@/lib/ecom/detail-page-suite/compose-slot-route";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id: projectId } = await ctx.params;
  return handleDetailPageSuiteComposeSlotPost(req, projectId, ECOM_AI_DETAIL_PAGE_MODULE);
}