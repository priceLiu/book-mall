import { Prisma } from "@prisma/client";

import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { rebuildModelShotItemPrompt } from "@/lib/ecom/model-shot/prompt-assembler";
import {
  ECOM_MODEL_SHOT_MODULE,
  ECOM_MODEL_SHOT_TRYON_ACTION,
  ECOM_MODEL_SHOT_TOOL_KEY,
  type ModelShotPoseItem,
} from "@/lib/ecom/ecom-model-shot-types";
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

function refUrls(project: Awaited<ReturnType<typeof getEcomModelShotProject>>): string[] {
  if (!project) return [];
  const urls: string[] = [];
  for (const role of ["garment", "model", "scene"] as const) {
    const ref = project.references.find((r) => r.role === role);
    if (ref?.ossUrl) urls.push(ref.ossUrl);
  }
  return urls;
}

export async function generateModelShotImages(opts: {
  userId: string;
  projectId: string;
  indexes?: number[];
  modelKey?: string;
}): Promise<{ generated: number; failures: string[]; project: NonNullable<Awaited<ReturnType<typeof getEcomModelShotProject>>> }> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const project = await getEcomModelShotProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.plan.status !== "confirmed") {
    throw new Error("请先在中栏确认姿势计划");
  }

  const modelKey = opts.modelKey?.trim() || project.settings.imageModelKey || ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const refs = refUrls(project);
  if (refs.length === 0) throw new Error("请先上传服装参考图");

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
      const item = project.plan.items.find((i) => i.index === index);
      if (!item?.prompt?.trim()) {
        failures.push(`第 ${index} 张：缺少 Prompt`);
        await clearModelShotPoseImagesPending(opts.projectId, [index]);
        await patchPoseItem(opts.userId, opts.projectId, index, { status: "failed" });
        return;
      }
      const prompt = rebuildModelShotItemPrompt({
        item,
        brief: project.brief,
        references: project.references,
      });

      try {
        const ossUrl = await generateEcomImage({
          userId: opts.userId,
          modelKey,
          prompt,
          ratio: "3:4",
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

        await patchPoseItem(opts.userId, opts.projectId, index, {
          imageUrl: ossUrl,
          assetId: asset.id,
          status: "ready",
          prompt,
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
  patch: Partial<ModelShotPoseItem>,
) {
  const project = await getEcomModelShotProject(userId, projectId);
  if (!project) return;
  const items = project.plan.items.map((item) =>
    item.index === index ? { ...item, ...patch } : item,
  );
  await updateEcomModelShotProject(userId, projectId, {
    plan: { ...project.plan, items },
  });
}
