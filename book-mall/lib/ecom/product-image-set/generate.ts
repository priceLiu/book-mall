import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { resolveEcomImageGenConcurrency } from "@/lib/ecom/ecom-image-gen-concurrency";
import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";

import {
  ECOM_PRODUCT_IMAGE_SET_GENERATE_ACTION,
  ECOM_PRODUCT_IMAGE_SET_MODULE,
  ECOM_PRODUCT_IMAGE_SET_TOOL_KEY,
  type ProductImageSetSlot,
} from "./types";
import {
  getProductImageSetProject,
  updateProductImageSetProject,
} from "./project-service";

async function clearProductImageSetGenerateBusy(opts: {
  userId: string;
  projectId: string;
  slots: ProductImageSetSlot[];
  targetIds: Set<string>;
  listingCopy?: string;
  failMessage?: string;
}): Promise<void> {
  const phase = opts.slots.some((s) => s.imageUrl?.trim()) ? ("planned" as const) : ("setup" as const);
  await updateProductImageSetProject(opts.userId, opts.projectId, {
    status: "draft",
    meta: { phase, genStartedAt: null },
    output: {
      slots: opts.slots.map((s) => {
        if (!opts.targetIds.has(s.id) || s.status !== "generating") return s;
        return {
          ...s,
          status: "failed" as const,
          failMessage: opts.failMessage ?? "生成中断，请重试",
        };
      }),
      listingCopy: opts.listingCopy,
    },
  });
}

export async function generateProductImageSet(opts: {
  userId: string;
  projectId: string;
  slotIds?: string[];
  modelKey?: string;
  imageSize?: string;
  /** 为 true 时允许对已出图槽位再次生成（单卡「重新生成」） */
  regenerate?: boolean;
}): Promise<{
  project: NonNullable<Awaited<ReturnType<typeof getProductImageSetProject>>>;
  generated: number;
  failures: Array<{ slotId: string; message: string }>;
}> {
  await assertEcomToolkitGatewayAccess(opts.userId);
  let project = await getProductImageSetProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.references.length === 0) throw new Error("请先上传商品原图");
  if (project.output.slots.length === 0) {
    throw new Error("请先在侧栏生成套图占位，再在中栏选择槽位出图");
  }

  const refUrls = project.references.map((r) => r.ossUrl);
  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;
  const imageSize =
    opts.imageSize?.trim() || project.settings.imageGenSize?.trim() || undefined;
  const ratio = project.settings.imageRatio ?? "1:1";
  const toolKey = `${ECOM_PRODUCT_IMAGE_SET_TOOL_KEY}__${ECOM_PRODUCT_IMAGE_SET_GENERATE_ACTION}`;

  const idFilter = opts.slotIds?.map((x) => x.trim()).filter(Boolean) ?? [];
  let targets: ProductImageSetSlot[];
  if (idFilter.length > 0) {
    const set = new Set(idFilter);
    targets = project.output.slots.filter((s) => set.has(s.id));
    if (!opts.regenerate) {
      targets = targets.filter((s) => !s.imageUrl?.trim());
    }
  } else {
    targets = project.output.slots.filter((s) => !s.imageUrl?.trim());
  }
  if (targets.length === 0) {
    throw new Error(
      opts.regenerate
        ? "请选择要生成的槽位"
        : "所选槽位均已出图；若要重做某张，请在该图悬停菜单点「重新生成」",
    );
  }

  const targetIds = new Set(targets.map((s) => s.id));
  const listingCopyBefore = project.output.listingCopy;

  try {
    await updateProductImageSetProject(opts.userId, opts.projectId, {
      settings: {
        imageModelKey: modelKey,
        ...(imageSize ? { imageGenSize: imageSize } : {}),
      },
      meta: { phase: "generating", genStartedAt: new Date().toISOString(), planStartedAt: null },
      status: "generating",
      output: {
        slots: project.output.slots.map((s) =>
          targetIds.has(s.id)
            ? { ...s, status: "generating" as const, failMessage: undefined }
            : s,
        ),
        listingCopy: listingCopyBefore,
      },
    });

    project = (await getProductImageSetProject(opts.userId, opts.projectId)) ?? project;

    const concurrency = await resolveEcomImageGenConcurrency(
      opts.userId,
      {},
      project.settings.imageGenConcurrency,
    );
    const failures: Array<{ slotId: string; message: string }> = [];
    let generated = 0;

    const resultById = new Map<string, ProductImageSetSlot>();

    await mapWithConcurrency(
      targets,
      async (slot) => {
        try {
          const imageUrl = await generateEcomImage({
            userId: opts.userId,
            modelKey,
            prompt: slot.prompt,
            ratio,
            imageSize,
            refImageUrls: refUrls,
            toolKey,
          });
          const { assetId } = await persistEcomGenerationRecord({
            userId: opts.userId,
            ossUrl: imageUrl,
            prompt: slot.prompt,
            title: slot.title,
            meta: {
              sourceModule: ECOM_PRODUCT_IMAGE_SET_MODULE,
              sourceToolKey: toolKey,
              projectId: opts.projectId,
              sourceResultId: slot.id,
              versionKey: `${opts.projectId}::${slot.id}`,
              modelKey,
            },
          });
          generated += 1;
          resultById.set(slot.id, {
            ...slot,
            imageUrl,
            assetId,
            status: "ready",
            failMessage: undefined,
          });
        } catch (e) {
          const { message } = formatEcomImageGenUserError(e);
          failures.push({ slotId: slot.id, message });
          resultById.set(slot.id, {
            ...slot,
            status: "failed",
            failMessage: message,
          });
        }
      },
      concurrency,
    );

    const mergedSlots = project.output.slots.map((s) => {
      const patch = resultById.get(s.id);
      if (patch) return patch;
      if (targetIds.has(s.id) && s.status === "generating") {
        return { ...s, status: "pending" as const };
      }
      return s;
    });

    const allReady = mergedSlots.every((s) => s.imageUrl?.trim());
    let listingCopy = project.output.listingCopy;
    if (project.settings.listingCopyEnabled && allReady && !listingCopy?.trim()) {
      try {
        const doc = project.meta.sellpointDocument ?? "";
        listingCopy = await drainEcomGwChat(opts.userId, {
          modelKey: project.settings.visionModelKey ?? "qwen3-max",
          messages: [
            {
              role: "system",
              content:
                "你是跨境电商 listing 文案专家。输出平台商品标题+五点描述，语言与用户设置一致，不要 markdown 代码块。",
            },
            {
              role: "user",
              content: `平台：${project.settings.platform ?? "amazon"}，市场：${project.settings.market ?? "us"}，语言：${project.settings.language ?? "英文"}。\n卖点资料：\n${doc}`,
            },
          ],
          clientPage: ecomClientPage(opts.userId, opts.projectId, toolKey),
        });
      } catch {
        /* 文案失败不阻断出图 */
      }
    }

    const doneCount = mergedSlots.filter((s) => s.imageUrl?.trim()).length;
    const phase = doneCount === mergedSlots.length ? "done" : "planned";

    project =
      (await updateProductImageSetProject(opts.userId, opts.projectId, {
        output: { slots: mergedSlots, listingCopy },
        meta: { phase, genStartedAt: null },
        status: failures.length === targets.length && generated === 0 ? "failed" : "ready",
      })) ?? project;

    return { project, generated, failures };
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    await clearProductImageSetGenerateBusy({
      userId: opts.userId,
      projectId: opts.projectId,
      slots: project.output.slots,
      targetIds,
      listingCopy: listingCopyBefore,
      failMessage: message,
    }).catch((clearErr) => {
      console.error("[product-image-set] clear generate busy failed", clearErr);
    });
    throw e;
  }
}
