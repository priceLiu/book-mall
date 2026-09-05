import type { SeedVideoDirectPlan } from "@/lib/seed-video-types";

export type SeedVideoDirectVideoItem = {
  id: string;
  videoUrl: string;
  taskId?: string;
  modelKey?: string;
  createdAt?: string;
};

/** 方案① · 历次直接成片（兼容仅 videoUrl 的旧项目） */
export function resolveSeedVideoDirectVideos(
  plan?: SeedVideoDirectPlan | null,
): SeedVideoDirectVideoItem[] {
  if (!plan) return [];
  const fromList = plan.generatedVideos?.filter((v) => v.videoUrl?.trim()) ?? [];
  if (fromList.length > 0) {
    return fromList.map((v) => ({
      id: v.id,
      videoUrl: v.videoUrl.trim(),
      taskId: v.taskId,
      modelKey: v.modelKey,
      createdAt: v.createdAt,
    }));
  }
  const legacy = plan.videoUrl?.trim();
  if (!legacy) return [];
  return [
    {
      id: plan.taskId?.trim() || legacy,
      videoUrl: legacy,
      taskId: plan.taskId,
    },
  ];
}
