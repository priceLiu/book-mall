import { mergeVtonMeta, sanitizeVtonProjectMeta } from "@/lib/ecom/ecom-vton/meta";
import { runEcomVtonTryonRefine } from "@/lib/ecom/ecom-vton/tryon-refiner";
import {
  appendVtonTryonResultVersion,
  resolveVtonTryonActiveOssUrl,
} from "@/lib/ecom/ecom-vton/tryon-result-versions";
import type {
  VtonProjectMeta,
  VtonTryonRefinerGender,
} from "@/lib/ecom/ecom-vton/types";
import { resolveLookTryonUrls } from "@/lib/ecom/ecom-vton/validate";

export async function refineVtonProjectTryonResult(opts: {
  userId: string;
  projectId: string;
  consumerToolKey: string;
  modelUrl: string;
  resultId: string;
  gender: VtonTryonRefinerGender;
  metaRaw: unknown;
  persistMeta: (meta: VtonProjectMeta) => Promise<void>;
}): Promise<VtonProjectMeta> {
  const meta = sanitizeVtonProjectMeta(opts.metaRaw);
  const batch = meta.tryonBatch;
  if (!batch) throw new Error("尚无试衣结果");
  if (batch.status === "running") throw new Error("试衣进行中，请稍后再精修");

  const result = batch.results.find((r) => r.id === opts.resultId);
  if (!result) throw new Error("试衣结果不存在");
  if (result.status !== "success") throw new Error("仅成功的试衣成片可精修");

  const coarseUrl = resolveVtonTryonActiveOssUrl(result);
  if (!coarseUrl) throw new Error("缺少试衣成片");

  const look = (meta.lookDrafts ?? []).find((l) => l.id === result.lookId);
  if (!look) throw new Error("搭配不存在");

  const garmentPool = meta.garmentPool ?? [];
  const urls = resolveLookTryonUrls({
    look,
    garmentPool,
    modelUrl: opts.modelUrl,
  });

  let workingMeta = mergeVtonMeta(meta, {
    tryonProgress: {
      phase: "submitting",
      label: "准备试衣精修…",
      updatedAt: new Date().toISOString(),
    },
  });
  await opts.persistMeta(workingMeta);

  const refinedUrl = await runEcomVtonTryonRefine({
    userId: opts.userId,
    consumerToolKey: opts.consumerToolKey,
    projectId: opts.projectId,
    personImageUrl: opts.modelUrl,
    lookKind: urls.lookKind,
    topGarmentUrl: urls.topGarmentUrl,
    bottomGarmentUrl: urls.bottomGarmentUrl,
    coarseImageUrl: coarseUrl,
    gender: opts.gender,
    onProgress: async (progress) => {
      workingMeta = mergeVtonMeta(workingMeta, { tryonProgress: progress });
      await opts.persistMeta(workingMeta);
    },
  });

  appendVtonTryonResultVersion(result, refinedUrl);
  const updatedResults = batch.results.map((r) => (r.id === result.id ? result : r));
  workingMeta = mergeVtonMeta(workingMeta, {
    tryonBatch: { ...batch, results: updatedResults, updatedAt: new Date().toISOString() },
    tryonProgress: {
      phase: "done",
      label: "精修完成",
      updatedAt: new Date().toISOString(),
    },
  });
  await opts.persistMeta(workingMeta);
  return workingMeta;
}
