import { prisma } from "@/lib/prisma";

type IpWorkflowAssetMeta = {
  projectId?: string;
  stepId?: string;
  index?: number;
  source?: string;
};

function readIpWorkflowAssetMeta(meta: unknown): IpWorkflowAssetMeta {
  if (!meta || typeof meta !== "object") return {};
  const o = meta as Record<string, unknown>;
  const indexRaw = o.index;
  const index =
    typeof indexRaw === "number" && Number.isFinite(indexRaw)
      ? indexRaw
      : typeof indexRaw === "string"
        ? Number.parseInt(indexRaw, 10)
        : undefined;
  return {
    projectId: typeof o.projectId === "string" ? o.projectId.trim() : undefined,
    stepId: typeof o.stepId === "string" ? o.stepId.trim() : undefined,
    index: index !== undefined && Number.isFinite(index) ? index : undefined,
    source: typeof o.source === "string" ? o.source.trim() : undefined,
  };
}

type AssetPick = {
  id: string;
  ossUrl: string;
  prompt: string | null;
  createdAt: Date;
};

function latestAssetByStepIndex(
  assets: Array<AssetPick & { meta: unknown }>,
  projectId: string,
  expectedSource: string,
): Map<string, AssetPick & { id: string }> {
  const map = new Map<string, AssetPick & { id: string }>();
  for (const asset of assets) {
    const meta = readIpWorkflowAssetMeta(asset.meta);
    if (meta.projectId !== projectId) continue;
    if (meta.source && meta.source !== expectedSource) continue;
    if (!meta.stepId || meta.index === undefined || meta.index <= 0) continue;
    const url = asset.ossUrl?.trim();
    if (!url) continue;
    const key = `${meta.stepId}::${meta.index}`;
    const prev = map.get(key);
    if (!prev || asset.createdAt > prev.createdAt) {
      map.set(key, { ...asset, id: asset.id });
    }
  }
  return map;
}

export type IpWorkflowReconcileStepState = {
  stepId: string;
  status: string;
  slots: Array<{
    index: number;
    imageUrl?: string;
    assetId?: string;
    prompt?: string;
    title?: string;
    promptEdited?: boolean;
  }>;
};

export type IpWorkflowReconcilePlan = {
  steps: Record<string, IpWorkflowReconcileStepState>;
};

export type IpWorkflowReconcileSlotTemplate = {
  index: number;
  title: string;
  prompt: string;
};

export function reconcileIpWorkflowPlanFromAssets(input: {
  plan: IpWorkflowReconcilePlan;
  byStepIndex: Map<string, AssetPick & { id: string }>;
  /** 槽位在 plan 中缺失时补齐（读项目 hydrate 后通常已有，兜底用） */
  resolveSlotTemplate?: (
    stepId: string,
    index: number,
  ) => IpWorkflowReconcileSlotTemplate | undefined;
}): { plan: IpWorkflowReconcilePlan; recoveredImages: number } {
  let recoveredImages = 0;
  const steps = { ...input.plan.steps };

  for (const [key, asset] of input.byStepIndex) {
    const sep = key.indexOf("::");
    if (sep <= 0) continue;
    const stepId = key.slice(0, sep);
    const index = Number.parseInt(key.slice(sep + 2), 10);
    if (!Number.isFinite(index)) continue;

    const url = asset.ossUrl.trim();
    let state = steps[stepId];
    if (!state) {
      state = { stepId, status: "pending", slots: [] };
    }
    let slots = [...(state.slots ?? [])];
    let slotChanged = false;

    const slotIdx = slots.findIndex((s) => s.index === index);
    if (slotIdx < 0) {
      const tpl = input.resolveSlotTemplate?.(stepId, index) ?? {
        index,
        title: `#${index}`,
        prompt: "",
      };
      slots.push({
        index: tpl.index,
        title: tpl.title,
        prompt: tpl.prompt,
        imageUrl: url,
        assetId: asset.id,
      });
      slotChanged = true;
      recoveredImages += 1;
    } else {
      const slot = slots[slotIdx]!;
      if (!slot.imageUrl?.trim()) {
        slots[slotIdx] = {
          ...slot,
          imageUrl: url,
          assetId: asset.id,
          prompt: slot.prompt?.trim() ? slot.prompt : asset.prompt?.trim() || slot.prompt,
        };
        slotChanged = true;
        recoveredImages += 1;
      }
    }

    if (slotChanged) {
      slots.sort((a, b) => a.index - b.index);
      const allHaveImage =
        slots.length > 0 && slots.every((s) => Boolean(s.imageUrl?.trim()));
      steps[stepId] = {
        ...state,
        stepId,
        slots,
        status: allHaveImage ? "ready" : state.status,
      };
    }
  }

  return { plan: { steps }, recoveredImages };
}

export async function loadIpWorkflowProjectAssets(opts: {
  userId: string;
  module: string;
  projectId: string;
  source: string;
}): Promise<Map<string, AssetPick & { id: string }>> {
  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId: opts.userId,
      module: opts.module,
      kind: "image",
      meta: {
        path: ["projectId"],
        equals: opts.projectId,
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      ossUrl: true,
      prompt: true,
      meta: true,
      createdAt: true,
    },
  });
  return latestAssetByStepIndex(assets, opts.projectId, opts.source);
}
