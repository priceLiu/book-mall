/**
 * 新工业化剧本解析行 → Pro2 列节点 row 映射
 * 真源：script-studio-parse.ts · 目标：story-pro-workspace-types 行类型
 */
import { nanoid } from "nanoid";
import type {
  ScriptStudioCharacterLock,
  ScriptStudioEpisode,
  ScriptStudioPropItem,
  ScriptStudioSceneArchive,
  ScriptStudioShot,
} from "./script-studio-parse";
import type {
  StoryProAudioRow,
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProMoodRow,
  StoryProPropRow,
  StoryProSceneRow,
} from "./story-pro-workspace-types";
import { storyProSceneRowKey } from "./story-pro-scene-asset-catalog";

function rowKey(prefix: string, name: string): string {
  const slug = name.trim().replace(/\s+/g, "-").slice(0, 48) || nanoid(6);
  return `${prefix}-${slug}`;
}

export function scriptStudioCharacterToProRow(
  c: ScriptStudioCharacterLock,
): StoryProCharacterRow {
  const appearance = [
    c.bodyType,
    c.faceShape,
    c.facialFeatures,
    c.temperament,
    c.skin,
    c.hair,
    c.outfit,
    c.accessories,
    c.episodeOutfit,
    c.emotion,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    key: rowKey("char", c.name),
    name: c.name,
    role: [c.age, c.speechStyle].filter(Boolean).join(" · "),
    appearance: appearance || c.behavior || "（待补充外观）",
    prompt: "",
  };
}

export function scriptStudioSceneToProRow(
  s: ScriptStudioSceneArchive,
  hubId: string,
): StoryProSceneRow {
  const description = [
    s.intExt,
    s.time,
    s.decor,
    s.lighting,
    s.mood,
    s.props,
    s.ambientSound,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    key: storyProSceneRowKey(hubId, s.name),
    name: s.name,
    description,
    prompt: description,
  };
}

export function scriptStudioPropToProRow(p: ScriptStudioPropItem): StoryProPropRow {
  const description = [p.type, p.role, p.texture, p.placement, p.eraOk]
    .filter(Boolean)
    .join(" · ");
  return {
    key: rowKey("prop", p.name),
    name: p.name,
    description,
    prompt: description,
  };
}

export function scriptStudioShotToProFrameRow(
  shot: ScriptStudioShot,
  hubId: string,
  sceneName?: string,
): StoryProFrameRow {
  const duration = parseInt(String(shot.duration).replace(/\D/g, ""), 10);
  return {
    frameIndex: shot.frameIndex,
    key: `${hubId}-f-${shot.frameIndex}`,
    shotSize: shot.shotSize,
    cameraMove: shot.cameraMove,
    durationSec: Number.isFinite(duration) ? duration : undefined,
    scene: sceneName ?? "",
    description: [shot.description, shot.characterDetail].filter(Boolean).join(" · "),
    dialogue: shot.dialogue,
    videoPrompt: shot.imagePrompt,
    prompt: shot.imagePrompt || shot.imagePromptZh,
    propRefIds: [],
  };
}

export function scriptStudioShotToMoodRow(shot: ScriptStudioShot): StoryProMoodRow | null {
  if (!shot.emotion?.trim() && !shot.bgm?.trim()) return null;
  const name = `镜${shot.frameIndex}`;
  return {
    key: rowKey("mood", name),
    name,
    description: [shot.emotion, shot.bgm].filter(Boolean).join(" · "),
    prompt: shot.imagePromptZh || shot.imagePrompt,
  };
}

export function scriptStudioSceneAmbientToAudioRow(
  s: ScriptStudioSceneArchive,
): StoryProAudioRow | null {
  if (!s.ambientSound?.trim()) return null;
  return {
    key: rowKey("audio", s.name),
    name: s.name,
    description: s.ambientSound,
    prompt: s.ambientSound,
  };
}

export type ScriptStudioEpisodeSync = {
  episodeNo: number;
  characters: StoryProCharacterRow[];
  scenes: StoryProSceneRow[];
  props: StoryProPropRow[];
  frames: StoryProFrameRow[];
  moods: StoryProMoodRow[];
  audios: StoryProAudioRow[];
};

/** 单集解析结果 → Pro2 列行（供 column-sync / spawn 使用） */
export function syncScriptStudioEpisodeToProRows(
  episode: ScriptStudioEpisode,
  hubId: string,
): ScriptStudioEpisodeSync {
  const characters = episode.characters.map(scriptStudioCharacterToProRow);
  const scenes = episode.scenes.map((s) => scriptStudioSceneToProRow(s, hubId));
  const props = episode.props.map(scriptStudioPropToProRow);
  const frames = episode.shots.map((shot) => {
    const sceneGuess =
      episode.scenes.find((s) =>
        shot.description.includes(s.name),
      )?.name ?? "";
    return scriptStudioShotToProFrameRow(shot, hubId, sceneGuess);
  });
  const moods = episode.shots
    .map(scriptStudioShotToMoodRow)
    .filter((r): r is StoryProMoodRow => r != null);
  const audios = episode.scenes
    .map(scriptStudioSceneAmbientToAudioRow)
    .filter((r): r is StoryProAudioRow => r != null);
  return {
    episodeNo: episode.episodeNo,
    characters,
    scenes,
    props,
    frames,
    moods,
    audios,
  };
}
