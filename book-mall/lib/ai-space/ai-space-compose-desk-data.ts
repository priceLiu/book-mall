/**
 * 合成台选材数据（形象 / 口播音频 / 背景视频）
 *
 * 合成台原先在 RSC 里串行拉这三份列表 + 两次收藏查询，共 5 条 SQL，
 * 其中两条还被 `Promise.all([f(await g())])` 写法卡成串行；
 * 叠上 dev:all 多进程抢连接池，一次「点开合成台」曾出现 68s 才回包、
 * 中途连接被服务端回收就整页报错——表现为「合成台打不开」。
 *
 * 现在集中在这里：三条列表查询真并行，收藏合成一条查询（共 4 条并行 SQL），
 * 由 /api/platform/v1/ai-space/compose-options 供客户端拉取，
 * 页面骨架先出、失败可原地重试，不再阻塞整页导航。
 */

import type { AiSpaceAudioAssetDto } from "./ai-space-audio-service";
import { listAiSpaceAudioAssets } from "./ai-space-audio-service";
import type { AiSpaceDigitalHumanDto } from "./ai-space-digital-human-types";
import { listAiSpaceDigitalHumans } from "./ai-space-digital-human-service";
import { getFavoriteTargetIdSets } from "./ai-space-favorite-service";
import { listAiSpaceVideoMaterials } from "./ai-space-video-material-service";
import type { AiSpaceVideoMaterialDto } from "./ai-space-video-types";

export type AiSpaceComposeDeskData = {
  digitalHumans: Array<AiSpaceDigitalHumanDto & { isFavorite: boolean }>;
  audioAssets: Array<AiSpaceAudioAssetDto & { isFavorite: boolean }>;
  backgrounds: AiSpaceVideoMaterialDto[];
};

export async function loadAiSpaceComposeDeskData(
  userId: string,
): Promise<AiSpaceComposeDeskData> {
  const [humans, audio, backgrounds, favorites] = await Promise.all([
    listAiSpaceDigitalHumans(userId, { activeOnly: true }),
    listAiSpaceAudioAssets(userId),
    listAiSpaceVideoMaterials(userId),
    getFavoriteTargetIdSets(userId, ["digital_human", "audio"]),
  ]);

  const favHumans = favorites.digital_human ?? new Set<string>();
  const favAudio = favorites.audio ?? new Set<string>();

  return {
    digitalHumans: humans.map((h) => ({ ...h, isFavorite: favHumans.has(h.id) })),
    audioAssets: audio.map((a) => ({ ...a, isFavorite: favAudio.has(a.id) })),
    backgrounds,
  };
}
