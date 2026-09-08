import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { resolveSeedVideoChatImageUrls } from "@/lib/ecom/ecom-seed-video-mention";
import {
  buildReplicaMentionCatalogFromPlan,
  resolveReplicaMentionImageUrls,
} from "@/lib/ecom/ecom-media-decompose-replica-refs";
import { readReplicaAssetPlan } from "@/lib/ecom/ecom-replica-asset-plan";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import { mergeSeedVideoShotsPreserveMedia } from "@/lib/ecom/ecom-seed-video-shot-merge";
import {
  ECOM_SEED_VIDEO_TOOL_KEY,
  type SeedVideoReference,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";

export async function ecomGenerateSeedVideoShotImage(opts: {
  userId: string;
  projectId: string;
  shotIndex: number;
  references: SeedVideoReference[];
  shots: SeedVideoShot[];
  modelKey: string;
  imageSize?: string;
  aspectRatio?: "16:9" | "9:16";
}): Promise<{ shotIndex: number; imageUrl: string }> {
  const shot = opts.shots.find((s) => s.index === opts.shotIndex);
  if (!shot) throw new Error(`找不到镜头 ${opts.shotIndex}`);

  const prompt = shot.imagePrompt?.trim();
  if (!prompt) throw new Error(`镜头 ${opts.shotIndex} 缺少生图 Prompt`);

  const project = await getEcomSeedVideoProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const assetPlan = readReplicaAssetPlan(project.meta);
  const catalog = assetPlan
    ? buildReplicaMentionCatalogFromPlan(assetPlan, opts.references)
    : [];
  const refUrls =
    catalog.length > 0
      ? resolveReplicaMentionImageUrls(prompt, catalog, opts.references, 9)
      : resolveSeedVideoChatImageUrls(opts.references, prompt, 9);
  const aspectRatio = opts.aspectRatio ?? "9:16";
  const ratio: EcomImageRatio = aspectRatio === "16:9" ? "16:9" : "4:5";

  const imageUrl = await generateEcomImage({
    userId: opts.userId,
    modelKey: opts.modelKey,
    prompt,
    ratio,
    imageSize: opts.imageSize,
    refImageUrls: refUrls,
    toolKey: `${ECOM_SEED_VIDEO_TOOL_KEY}__replica-shot-image`,
  });

  const merged = mergeSeedVideoShotsPreserveMedia(
    opts.shots.map((s) =>
      s.index === opts.shotIndex ? { ...s, imageUrl, imageTaskId: undefined } : s,
    ),
    project.plan?.shots ?? [],
  );

  await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
    plan: { ...(project.plan ?? {}), shots: merged },
  });

  return { shotIndex: opts.shotIndex, imageUrl };
}
