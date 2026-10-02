import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildBrandViSlotPrompt,
  requireBrandViStep,
  type BrandViStepDef,
  type BrandViStepId,
} from "@/lib/ecom/ecom-brand-vi-steps";
import {
  getEcomBrandViProject,
  missingRequirementLabels,
  patchBrandViStep,
  readBrandViStepState,
  updateEcomBrandViProject,
  type EcomBrandViProjectDto,
} from "@/lib/ecom/ecom-brand-vi-service";
import {
  ECOM_BRAND_VI_GENERATE_ACTION,
  ECOM_BRAND_VI_MODULE,
  ECOM_BRAND_VI_TOOL_KEY,
  type BrandViSlot,
} from "@/lib/ecom/ecom-brand-vi-types";
import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { getImageGenMaxRefs } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { finalizeIpWorkflowStepAfterBatch } from "@/lib/ecom/ecom-ip-workflow-step-gen-finalize";
import { withEcomIpWorkflowStepGenerationLock } from "@/lib/ecom/ecom-ip-workflow-step-gen-lock";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { prisma } from "@/lib/prisma";

export type GenerateBrandViStepResult = {
  stepId: BrandViStepId;
  slots: BrandViSlot[];
  generated: number;
  failures: Array<{ index: number; message: string }>;
};

/**
 * 本步送入生图模型的参考图。
 *
 * 第 1 步：用户线稿；其余步骤：**第 1 位恒为定稿主形象**，后面再补线稿做结构兜底。
 * 顺序是硬约定 —— Prompt 里写的「参考图第 1 张为基准主形象」必须与之对齐。
 */
function resolveStepRefUrls(opts: {
  project: EcomBrandViProjectDto;
  step: BrandViStepDef;
  modelKey: string;
}): string[] {
  const sketches = opts.project.references.map((r) => r.ossUrl);
  const max = Math.max(1, getImageGenMaxRefs(opts.modelKey));
  if (opts.step.id === "hero") return sketches.slice(0, max);

  const hero = opts.project.meta?.workflow?.heroLockedUrl?.trim();
  const heroUrls = hero ? [hero] : [];
  return [...heroUrls, ...sketches].slice(0, max);
}

function assetTitleFor(step: BrandViStepDef, slot: BrandViSlot): string {
  return `${step.label} · ${slot.title}`.slice(0, 80);
}

/**
 * 生成某一步的槽位图。indexes 为空表示生成本步全部槽位。
 *
 * 出图落 EcomAsset（module: brand-vi），并在第 1 步成功后把主形象 URL 写进
 * meta.workflow.heroLockedUrl，作为后续 9 步的一致性锚点。
 */
export async function generateBrandViStepImages(opts: {
  userId: string;
  projectId: string;
  stepId: BrandViStepId;
  indexes?: number[];
  modelKey?: string;
  concurrency?: number;
  imageSize?: string;
}): Promise<GenerateBrandViStepResult> {
  return withEcomIpWorkflowStepGenerationLock(
    `${opts.projectId}:${opts.stepId}`,
    () => generateBrandViStepImagesInner(opts),
  );
}

async function generateBrandViStepImagesInner(opts: {
  userId: string;
  projectId: string;
  stepId: BrandViStepId;
  indexes?: number[];
  modelKey?: string;
  concurrency?: number;
  imageSize?: string;
}): Promise<GenerateBrandViStepResult> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const step = requireBrandViStep(opts.stepId);
  if (step.kind !== "generate") {
    throw new Error(`第 ${step.no} 步「${step.label}」为排版步骤，请在工作区执行拼版`);
  }

  const project = await getEcomBrandViProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.references.length === 0) {
    throw new Error("请先上传手绘线稿");
  }

  const missing = missingRequirementLabels(project.plan, opts.stepId);
  if (missing.length > 0) {
    throw new Error(`请先完成：${missing.join("、")}`);
  }
  if (step.id !== "hero" && !project.meta?.workflow?.heroLockedUrl) {
    throw new Error("请先在第 1 步定稿核心主形象，后续步骤需以它为基准");
  }

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  const state = readBrandViStepState(project.plan, opts.stepId);
  const wanted =
    opts.indexes && opts.indexes.length > 0
      ? state.slots.filter((s) => opts.indexes!.includes(s.index))
      : state.slots;
  if (wanted.length === 0) throw new Error("找不到要生成的槽位");

  const refImageUrls = resolveStepRefUrls({ project, step, modelKey });
  const concurrency = await resolveEcomImageGenConcurrency(
    opts.userId,
    project.settings,
    opts.concurrency,
  );

  await patchBrandViStep(opts.userId, opts.projectId, opts.stepId, {
    status: "generating",
  });
  await updateEcomBrandViProject(opts.userId, opts.projectId, {
    settings: { imageModelKey: modelKey },
    meta: { workflow: { currentStepId: opts.stepId } },
  });

  let slots = [...state.slots];
  const failures: GenerateBrandViStepResult["failures"] = [];
  let generated = 0;
  const wantedIndexes = wanted.map((s) => s.index);

  const finalizeBatch = async () => {
    await finalizeIpWorkflowStepAfterBatch({
      slotsSnapshot: slots,
      wantedIndexes,
      generated,
      failures,
      readStepSlots: async () => {
        const fresh = await getEcomBrandViProject(opts.userId, opts.projectId);
        if (!fresh) return slots;
        return readBrandViStepState(fresh.plan, opts.stepId).slots;
      },
      patchStep: async (patch) => {
        await patchBrandViStep(opts.userId, opts.projectId, opts.stepId, patch);
      },
    });
  };

  // 逐张回写 plan：批量步骤有 12 槽，不能等全部结束再落库，否则中途失败全丢
  let writeLock = Promise.resolve();
  const withWriteLock = async <T>(fn: () => Promise<T>): Promise<T> => {
    const prev = writeLock;
    let release!: () => void;
    writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  };

  try {
  await mapWithConcurrency(
    wanted,
    async (slot) => {
      const prompt = buildBrandViSlotPrompt({
        step,
        slotTitle: slot.title,
        slotPrompt: slot.prompt,
        refCount: refImageUrls.length,
        isHeroStep: step.id === "hero",
        settings: project.settings,
      });

      try {
        const ossUrl = await generateEcomImage({
          userId: opts.userId,
          modelKey,
          prompt,
          ratio: step.ratio,
          imageSize: opts.imageSize,
          refImageUrls,
          toolKey: `${ECOM_BRAND_VI_TOOL_KEY}__${ECOM_BRAND_VI_GENERATE_ACTION}`,
        });

        const asset = await prisma.ecomAsset.create({
          data: {
            userId: opts.userId,
            module: ECOM_BRAND_VI_MODULE,
            kind: "image",
            title: assetTitleFor(step, slot),
            prompt,
            ossUrl,
            thumbnailUrl: ossUrl,
            meta: {
              projectId: opts.projectId,
              projectName: project.title?.trim() || undefined,
              source: "brand-vi",
              stepId: step.id,
              stepNo: step.no,
              index: slot.index,
              ratio: step.ratio,
              modelKey,
            },
          },
        });

        await withWriteLock(async () => {
          slots = slots.map((s) =>
            s.index === slot.index ? { ...s, imageUrl: ossUrl, assetId: asset.id } : s,
          );
          generated += 1;
          await patchBrandViStep(opts.userId, opts.projectId, opts.stepId, {
            slots,
            status: slots.every((s) => s.imageUrl) ? "ready" : "generating",
          });
        });
      } catch (e) {
        const { message } = formatEcomImageGenUserError(e);
        await withWriteLock(async () => {
          failures.push({
            index: slot.index,
            message,
          });
        });
      }
    },
    concurrency,
  );

  await finalizeBatch();
  const freshAfter = await getEcomBrandViProject(opts.userId, opts.projectId);
  const dbSlotsAfter = freshAfter
    ? readBrandViStepState(freshAfter.plan, opts.stepId).slots
    : slots;
  const allDone =
    dbSlotsAfter.length > 0 && dbSlotsAfter.every((s) => Boolean(s.imageUrl?.trim()));

  // 第 1 步定稿即锁定全局基准形象
  if (step.id === "hero" && allDone) {
    const heroUrl = dbSlotsAfter[0]?.imageUrl;
    if (heroUrl) {
      await updateEcomBrandViProject(opts.userId, opts.projectId, {
        meta: { workflow: { heroLockedUrl: heroUrl, currentStepId: "turnaround" } },
      });
    }
  }

  return { stepId: opts.stepId, slots: dbSlotsAfter, generated, failures };
  } catch (e) {
    await finalizeBatch().catch(() => undefined);
    throw e;
  }
}
