import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { getModelLibraryEntry } from "@/lib/ecom/ecom-model-library-service";
import { assemblePoseStudioPreviewPrompt } from "@/lib/ecom/ecom-pose-library-generate-prompt";
import {
  getPoseLibraryEntry,
  upsertPoseLibraryEntry,
  type EcomPoseLibraryEntry,
} from "@/lib/ecom/ecom-pose-library-service";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";

const POSE_STUDIO_TOOL_KEY = "ecom-toolkit__pose-library-studio";

export type GeneratePosePreviewInput = {
  adminUserId: string;
  poseIds: string[];
  modelCatalogId: string;
  garmentOssUrl?: string;
  garmentDescription?: string;
  sceneText?: string;
  modelKey?: string;
  ratio?: "3:4" | "1:1" | "4:5" | "16:9";
};

export type GeneratePosePreviewItemResult = {
  poseId: string;
  ok: boolean;
  entry?: EcomPoseLibraryEntry;
  error?: string;
};

export async function generatePoseLibraryPreviews(
  input: GeneratePosePreviewInput,
): Promise<{ results: GeneratePosePreviewItemResult[] }> {
  const poseIds = [...new Set(input.poseIds.map((id) => id.trim()).filter(Boolean))];
  if (poseIds.length === 0) throw new Error("请至少选择一条姿势");

  const modelEntry = await getModelLibraryEntry(input.modelCatalogId.trim());
  if (!modelEntry?.ossUrl?.trim()) throw new Error("模特库条目不存在或缺少预览图");

  const modelKey = input.modelKey?.trim() || ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const ratio = input.ratio ?? "3:4";
  const sceneText = input.sceneText?.trim() || "浅灰摄影棚背景，均匀柔光";
  const refImageUrls = [
    input.garmentOssUrl?.trim(),
    modelEntry.ossUrl.trim(),
  ].filter(Boolean) as string[];

  const results: GeneratePosePreviewItemResult[] = [];

  await mapWithConcurrency(
    poseIds,
    async (poseId) => {
      const pose = await getPoseLibraryEntry(poseId);
      if (!pose) {
        results.push({ poseId, ok: false, error: "姿势条目不存在" });
        return;
      }
      if (!pose.baseDescription?.trim()) {
        results.push({ poseId, ok: false, error: "缺少姿势描述，请先填写 baseDescription" });
        return;
      }

      const prompt = assemblePoseStudioPreviewPrompt({
        poseDescription: pose.baseDescription,
        garmentDescription: input.garmentDescription,
        hasGarmentRef: Boolean(input.garmentOssUrl?.trim()),
        sceneText,
      });

      try {
        const ossUrl = await generateEcomImage({
          userId: input.adminUserId,
          modelKey,
          prompt,
          ratio,
          refImageUrls,
          toolKey: POSE_STUDIO_TOOL_KEY,
        });

        const entry = await upsertPoseLibraryEntry({
          ...pose,
          ossUrl,
          thumbUrl: ossUrl,
          tags: {
            ...(pose.tags ?? {}),
            generatedFrom: "pose-studio",
            modelCatalogId: input.modelCatalogId,
            garmentOssUrl: input.garmentOssUrl,
            generatedAt: new Date().toISOString(),
          },
        });
        results.push({ poseId, ok: true, entry });
      } catch (e) {
        results.push({
          poseId,
          ok: false,
          error: e instanceof Error ? e.message : "生成失败",
        });
      }
    },
    2,
  );

  return { results };
}
