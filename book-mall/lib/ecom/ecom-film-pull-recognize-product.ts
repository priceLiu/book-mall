import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { resolveRecognizeProductModel } from "@/lib/ecom/ecom-media-decompose-replica";
import {
  buildReplicaProductRecognizePrompt,
  formatProductBriefFromRecognition,
} from "@/lib/ecom/ecom-media-decompose-replica-script";
import { listFilmPullProductRefs } from "@/lib/ecom/ecom-film-pull-refs";
import {
  getEcomFilmPullProject,
  updateEcomFilmPullProject,
} from "@/lib/ecom/ecom-film-pull-service";
import {
  ECOM_FILM_PULL_TOOL_KEY,
  type FilmPullProjectDto,
} from "@/lib/ecom/ecom-film-pull-types";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ecomGwChatComplete } from "@/lib/gateway/ecom-tool-gateway-client";

const RECOGNIZE_ACTION = "recognize-product";

export async function recognizeFilmPullProduct(
  userId: string,
  projectId: string,
  opts?: { userDraft?: string },
): Promise<{ project: FilmPullProjectDto; productBrief: string }> {
  const userDraft = opts?.userDraft?.trim() ?? "";
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const productRefs = listFilmPullProductRefs(project.characterRefs);
  if (productRefs.length === 0) throw new Error("请先上传产品图");

  const chatModel = resolveRecognizeProductModel();

  const parts: CanvasChatContentPart[] = [
    ...productRefs.map(
      (ref) =>
        ({ type: "image_url", image_url: { url: ref.ossUrl } }) satisfies CanvasChatContentPart,
    ),
    {
      type: "text",
      text: buildReplicaProductRecognizePrompt(productRefs.length, userDraft || undefined),
    },
  ];

  const { text } = await ecomGwChatComplete(userId, {
    modelKey: chatModel,
    messages: [{ role: "user", content: parts }],
    clientPage: ecomClientPage(
      userId,
      projectId,
      `${ECOM_FILM_PULL_TOOL_KEY}__${RECOGNIZE_ACTION}`,
    ),
  });

  const productBrief = formatProductBriefFromRecognition(text);
  const updated = await updateEcomFilmPullProject(userId, projectId, {
    meta: { ...(project.meta ?? {}), productBrief },
  });

  return { project: updated, productBrief };
}
