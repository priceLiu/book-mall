import { Prisma } from "@prisma/client";

import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { rebuildModelShotItemPrompt } from "@/lib/ecom/model-shot/prompt-assembler";
import { buildModelShotRefImageUrls } from "@/lib/ecom/model-shot/pose-ref";
import { resolvePoseRefUrl } from "@/lib/ecom/ecom-pose-library-import";
import { appendModelShotPoseImage } from "@/lib/ecom/model-shot/pose-image-history";
import {
  ECOM_MODEL_SHOT_MODULE,
  ECOM_MODEL_SHOT_TRYON_ACTION,
  ECOM_MODEL_SHOT_TOOL_KEY,
  hasGarmentReference,
  parseModelShotPlan,
  type ModelShotPoseItem,
} from "@/lib/ecom/ecom-model-shot-types";
import { touchCatalogLockOnProjectUse } from "@/lib/ecom/ecom-catalog-lock";
import {
  getEcomModelShotProject,
  updateEcomModelShotProject,
} from "@/lib/ecom/ecom-model-shot-service";
import {
  claimModelShotPoseImageGeneration,
  clearModelShotPoseImagesPending,
} from "@/lib/ecom/ecom-model-shot-pending-images";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { prisma } from "@/lib/prisma";

function refUrls(
  project: Awaited<ReturnType<typeof getEcomModelShotProject>>,
  item?: { poseRefUrl?: string; poseId?: string },
  modelKey?: string,
): string[] {
  if (!project) return [];
  const poseRef =
    item?.poseRefUrl?.trim() ||
    undefined;
  return buildModelShotRefImageUrls({
    references: project.references,
    poseRefUrl: poseRef,
    modelKey,
  });
}

export async function generateModelShotImages(opts: {
  userId: string;
  projectId: string;
  indexes?: number[];
  modelKey?: string;
  imageSize?: string;
}): Promise<{ generated: number; failures: string[]; project: NonNullable<Awaited<ReturnType<typeof getEcomModelShotProject>>> }> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const project = await getEcomModelShotProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.plan.status !== "confirmed") {
    throw new Error("请先在中栏确认姿势计划");
  }

  const modelKey = opts.modelKey?.trim() || project.settings.imageModelKey || ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  if (!hasGarmentReference(project.references)) {
    throw new Error("请先上传服装参考图");
  }

  const targetIndexes =
    opts.indexes?.length && opts.indexes.length > 0
      ? opts.indexes
      : project.plan.items.map((i) => i.index);

  const claimed = await claimModelShotPoseImageGeneration(
    opts.projectId,
    targetIndexes,
    modelKey,
  );
  if (claimed.length === 0) {
    throw new Error("所选姿势正在生成中，请稍候或在右下角查看进度");
  }

  const failures: string[] = [];
  let generated = 0;

  for (const index of claimed) {
    await patchPoseItem(opts.userId, opts.projectId, index, { status: "generating" });
  }

  await updateEcomModelShotProject(opts.userId, opts.projectId, {
    status: "generating",
  });

  await mapWithConcurrency(
    claimed,
    async (index) => {
      const live = await getEcomModelShotProject(opts.userId, opts.projectId);
      const item = live?.plan.items.find((i) => i.index === index);
      if (!item?.prompt?.trim()) {
        failures.push(`第 ${index} 张：缺少 Prompt`);
        await clearModelShotPoseImagesPending(opts.projectId, [index]);
        await patchPoseItem(opts.userId, opts.projectId, index, { status: "failed" });
        return;
      }

      let poseRefUrl = item.poseRefUrl?.trim();
      if (!poseRefUrl && item.poseId) {
        poseRefUrl = (await resolvePoseRefUrl(item.poseId)) ?? undefined;
      }

      const refs = refUrls(live!, { poseRefUrl, poseId: item.poseId }, modelKey);

      const prompt = rebuildModelShotItemPrompt({
        item: { ...item, poseRefUrl },
        brief: live!.brief,
        references: live!.references,
      });

      try {
        const ossUrl = await generateEcomImage({
          userId: opts.userId,
          modelKey,
          prompt,
          ratio: "3:4",
          imageSize: opts.imageSize,
          refImageUrls: refs,
          toolKey: `${ECOM_MODEL_SHOT_TOOL_KEY}__${ECOM_MODEL_SHOT_TRYON_ACTION}`,
        });

        const asset = await prisma.ecomAsset.create({
          data: {
            userId: opts.userId,
            module: ECOM_MODEL_SHOT_MODULE,
            kind: "image",
            title: item.title ?? `模特图 ${index}`,
            prompt,
            ossUrl,
            thumbnailUrl: ossUrl,
            meta: { projectId: opts.projectId, index, modelKey },
          },
        });

        await patchPoseItem(opts.userId, opts.projectId, index, (current) => {
          const merged = appendModelShotPoseImage(current, {
            url: ossUrl,
            assetId: asset.id,
          });
          return { ...merged, status: "ready", prompt };
        });
        await clearModelShotPoseImagesPending(opts.projectId, [index]);
        generated += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "生成失败";
        failures.push(`第 ${index} 张：${msg}`);
        await clearModelShotPoseImagesPending(opts.projectId, [index]);
        await patchPoseItem(opts.userId, opts.projectId, index, { status: "failed" });
      }
    },
    2,
  );

  const fresh = await getEcomModelShotProject(opts.userId, opts.projectId);
  if (!fresh) throw new Error("项目不存在");

  await updateEcomModelShotProject(opts.userId, opts.projectId, {
    status:
      generated === 0 && failures.length >= claimed.length ? "draft" : "completed",
  });

  const finalProject = await getEcomModelShotProject(opts.userId, opts.projectId);
  if (!finalProject) throw new Error("项目不存在");

  if (generated > 0) {
    await touchCatalogLockOnProjectUse(finalProject);
  }

  if (claimed.length > 0 && generated === 0 && failures.length >= claimed.length) {
    throw new Error(
      failures.length > 0
        ? failures.join("；")
        : "未生成任何模特图，请确认姿势计划、参考图与 Gateway 凭证",
    );
  }

  return { generated, failures, project: finalProject };
}

async function patchPoseItem(
  userId: string,
  projectId: string,
  index: number,
  patch:
    | Partial<ModelShotPoseItem>
    | ((item: ModelShotPoseItem) => Partial<ModelShotPoseItem>),
) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const row = await prisma.ecomModelShotProject.findFirst({
      where: { id: projectId, userId, module: ECOM_MODEL_SHOT_MODULE },
      select: { plan: true, updatedAt: true },
    });
    if (!row) return;
    const plan = parseModelShotPlan(row.plan);
    const item = plan.items.find((i) => i.index === index);
    if (!item) return;
    const patchData = typeof patch === "function" ? patch(item) : patch;
    const items = plan.items.map((i) =>
      i.index === index ? { ...i, ...patchData } : i,
    );
    const updated = await prisma.ecomModelShotProject.updateMany({
      where: { id: projectId, updatedAt: row.updatedAt },
      data: { plan: { ...plan, items } as Prisma.InputJsonValue },
    });
    if (updated.count === 1) return;
  }
  throw new Error(`姿势 ${index} 数据更新冲突，请刷新后重试`);
}
