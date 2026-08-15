import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  buildHandCraftSlotPrompt,
  requireHandCraftStep,
  type HandCraftStepDef,
  type HandCraftStepId,
} from "@/lib/ecom/ecom-hand-craft-steps";
import {
  getEcomHandCraftProject,
  missingRequirementLabels,
  patchHandCraftStep,
  readHandCraftStepState,
  updateEcomHandCraftProject,
  type EcomHandCraftProjectDto,
} from "@/lib/ecom/ecom-hand-craft-service";
import {
  ECOM_HAND_CRAFT_GENERATE_ACTION,
  ECOM_HAND_CRAFT_MODULE,
  ECOM_HAND_CRAFT_TOOL_KEY,
  type HandCraftSlot,
} from "@/lib/ecom/ecom-hand-craft-types";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { getImageGenMaxRefs } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { prisma } from "@/lib/prisma";

export type GenerateHandCraftStepResult = {
  stepId: HandCraftStepId;
  slots: HandCraftSlot[];
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
  project: EcomHandCraftProjectDto;
  step: HandCraftStepDef;
  modelKey: string;
}): string[] {
  const sketches = opts.project.references.map((r) => r.ossUrl);
  const max = Math.max(1, getImageGenMaxRefs(opts.modelKey));
  if (opts.step.id === "hero") return sketches.slice(0, max);

  const hero = opts.project.meta?.workflow?.heroLockedUrl?.trim();
  const heroUrls = hero ? [hero] : [];
  return [...heroUrls, ...sketches].slice(0, max);
}

function assetTitleFor(step: HandCraftStepDef, slot: HandCraftSlot): string {
  return `${step.label} · ${slot.title}`.slice(0, 80);
}

/**
 * 生成某一步的槽位图。indexes 为空表示生成本步全部槽位。
 *
 * 出图落 EcomAsset（module: hand-craft），并在第 1 步成功后把主形象 URL 写进
 * meta.workflow.heroLockedUrl，作为后续 9 步的一致性锚点。
 */
export async function generateHandCraftStepImages(opts: {
  userId: string;
  projectId: string;
  stepId: HandCraftStepId;
  indexes?: number[];
  modelKey?: string;
  concurrency?: number;
}): Promise<GenerateHandCraftStepResult> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const step = requireHandCraftStep(opts.stepId);
  if (step.kind !== "generate") {
    throw new Error(`第 ${step.no} 步「${step.label}」为排版步骤，请在工作区执行拼版`);
  }

  const project = await getEcomHandCraftProject(opts.userId, opts.projectId);
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

  const state = readHandCraftStepState(project.plan, opts.stepId);
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

  await patchHandCraftStep(opts.userId, opts.projectId, opts.stepId, {
    status: "generating",
  });
  await updateEcomHandCraftProject(opts.userId, opts.projectId, {
    settings: { imageModelKey: modelKey },
    meta: { workflow: { currentStepId: opts.stepId } },
  });

  let slots = [...state.slots];
  const failures: GenerateHandCraftStepResult["failures"] = [];
  let generated = 0;

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

  await mapWithConcurrency(
    wanted,
    async (slot) => {
      const prompt = buildHandCraftSlotPrompt({
        step,
        slotTitle: slot.title,
        slotPrompt: slot.prompt,
        refCount: refImageUrls.length,
        isHeroStep: step.id === "hero",
      });

      try {
        const ossUrl = await generateEcomImage({
          userId: opts.userId,
          modelKey,
          prompt,
          ratio: step.ratio,
          refImageUrls,
          toolKey: `${ECOM_HAND_CRAFT_TOOL_KEY}__${ECOM_HAND_CRAFT_GENERATE_ACTION}`,
        });

        const asset = await prisma.ecomAsset.create({
          data: {
            userId: opts.userId,
            module: ECOM_HAND_CRAFT_MODULE,
            kind: "image",
            title: assetTitleFor(step, slot),
            prompt,
            ossUrl,
            thumbnailUrl: ossUrl,
            meta: {
              projectId: opts.projectId,
              projectName: project.title?.trim() || undefined,
              source: "hand-craft",
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
          await patchHandCraftStep(opts.userId, opts.projectId, opts.stepId, {
            slots,
            status: slots.every((s) => s.imageUrl) ? "ready" : "generating",
          });
        });
      } catch (e) {
        await withWriteLock(async () => {
          failures.push({
            index: slot.index,
            message: e instanceof Error ? e.message : "生成失败",
          });
        });
      }
    },
    concurrency,
  );

  const allDone = slots.length > 0 && slots.every((s) => s.imageUrl);
  await patchHandCraftStep(opts.userId, opts.projectId, opts.stepId, {
    slots,
    status: allDone ? "ready" : "pending",
  });

  // 第 1 步定稿即锁定全局基准形象
  if (step.id === "hero" && allDone) {
    const heroUrl = slots[0]?.imageUrl;
    if (heroUrl) {
      await updateEcomHandCraftProject(opts.userId, opts.projectId, {
        meta: { workflow: { heroLockedUrl: heroUrl, currentStepId: "spec-kit" } },
      });
    }
  }

  if (generated === 0 && failures.length > 0) {
    throw new Error(failures[0]!.message);
  }

  return { stepId: opts.stepId, slots, generated, failures };
}
