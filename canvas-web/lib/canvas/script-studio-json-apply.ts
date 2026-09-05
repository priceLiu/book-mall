/**
 * Script Studio JSON 批次 → Hub rows / display MD / canonical 存库
 */
import {
  SCRIPT_STUDIO_BIBLE_FILES,
  type ScriptStudioSystem,
} from "./script-studio-prompts";
import type {
  ScriptStudioBatchJson,
  ScriptStudioEpisodeJson,
  ScriptStudioFrozenBiblesJson,
} from "./data/script-studio-batch-schema";
import { SCRIPT_STUDIO_BATCH_FENCE_TAG } from "./data/script-studio-batch-schema";
import type {
  ScriptStudioCharacterLock,
  ScriptStudioEpisode,
  ScriptStudioPropItem,
  ScriptStudioSceneArchive,
  ScriptStudioShot,
} from "./script-studio-parse";
import { syncScriptStudioEpisodeToProRows } from "./script-studio-column-sync";

function extractJsonFromFence(text: string): unknown | null {
  const fenceRe = new RegExp(
    `\`\`\`${SCRIPT_STUDIO_BATCH_FENCE_TAG}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
    "i",
  );
  const m = text.match(fenceRe);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1].trim());
    } catch {
      return null;
    }
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"schemaVersion"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

/** 从 LLM 输出提取 script-studio-batch JSON（不做 Zod · 供 apply 前快速判断） */
export function extractScriptStudioBatchRaw(
  text: string,
): ScriptStudioBatchJson | null {
  const raw = extractJsonFromFence(text);
  if (!raw || typeof raw !== "object") return null;
  return raw as ScriptStudioBatchJson;
}

export function isScriptStudioJsonOutput(text: string): boolean {
  return Boolean(extractJsonFromFence(text));
}

/** JSON episode → script-studio-parse 同构类型（供 syncScriptStudioEpisodeToProRows） */
export function scriptStudioJsonEpisodeToParseEpisode(
  ep: ScriptStudioEpisodeJson,
): ScriptStudioEpisode {
  const promptMap = new Map(
    ep.module8_imagePrompts.map((p) => [p.frameIndex, p]),
  );
  const shots: ScriptStudioShot[] = ep.module7_storyboard.map((s) => ({
    frameIndex: s.frameIndex,
    duration: s.duration,
    shotSize: s.shotSize,
    cameraMove: s.cameraMove,
    description: s.description,
    characterDetail: s.characterDetail,
    dialogue: s.dialogue,
    emotion: s.emotion,
    bgm: s.bgm,
    imagePrompt: promptMap.get(s.frameIndex)?.en ?? "",
    imagePromptZh: promptMap.get(s.frameIndex)?.zh ?? "",
  }));
  return {
    episodeNo: ep.episodeNo,
    title: ep.title ?? "",
    characters: ep.module2_characters as ScriptStudioCharacterLock[],
    scenes: ep.module3_scenes as ScriptStudioSceneArchive[],
    props: ep.module4_props as ScriptStudioPropItem[],
    shots,
  };
}

function renderEpisodeMarkdown(ep: ScriptStudioEpisodeJson): string {
  const title = ep.title?.trim() ? ` ${ep.title.trim()}` : "";
  const lines: string[] = [`# 第${ep.episodeNo}集${title}`, ""];

  const m1 = ep.module1_base;
  lines.push(
    "## 模块1：本集基础档案",
    `- 集数：${m1.episodeNo}`,
    `- 单集标准时长：${m1.standardDuration}`,
    `- 本集核心主题：${m1.coreTheme}`,
    `- 承接上一集结尾剧情：${m1.prevEpisodeHook}`,
    `- 本集独立矛盾闭环结果：${m1.conflictClosure}`,
    `- 本集唯一跨集结尾悬念：${m1.cliffhanger}`,
    "",
  );

  lines.push(
    "## 模块2：本集出场人物完整版视觉锁定复盘",
    "| 姓名 | 年龄 | 身高体型 | 脸型骨相 | 五官细节 | 神态气质 | 皮肤质感 | 发型体系 | 全套穿搭 | 固定配饰 | 本集临时穿搭 | 本集情绪 | 行为逻辑 | 台词风格 |",
    "|------|------|------|------|------|------|------|------|------|------|------|------|------|------|",
  );
  for (const c of ep.module2_characters) {
    lines.push(
      `| ${c.name} | ${c.age} | ${c.bodyType} | ${c.faceShape} | ${c.facialFeatures} | ${c.temperament} | ${c.skin} | ${c.hair} | ${c.outfit} | ${c.accessories} | ${c.episodeOutfit} | ${c.emotion} | ${c.behavior} | ${c.speechStyle} |`,
    );
  }
  lines.push("");

  lines.push(
    "## 模块3：本集场景完整环境档案",
    "| 场景名称 | 内外景 | 时间区间 | 年代装修布局 | 光影参数 | 环境氛围 | 常驻道具 | 背景音效 |",
    "|------|------|------|------|------|------|------|------|",
  );
  for (const s of ep.module3_scenes) {
    lines.push(
      `| ${s.name} | ${s.intExt} | ${s.time} | ${s.decor} | ${s.lighting} | ${s.mood} | ${s.props} | ${s.ambientSound} |`,
    );
  }
  lines.push("");

  if (ep.module4_props.length) {
    lines.push(
      "## 模块4：本集道具精细化清单",
      "| 道具名称 | 类型 | 剧情作用 | 质感/新旧 | 摆放/手持位置 | 年代合规 | 是否特写 |",
      "|------|------|------|------|------|------|------|",
    );
    for (const p of ep.module4_props) {
      lines.push(
        `| ${p.name} | ${p.type} | ${p.role} | ${p.texture} | ${p.placement} | ${p.eraOk} | ${p.closeUp} |`,
      );
    }
    lines.push("");
  }

  lines.push("## 模块5：本集结构化完整大纲", ep.module5_outline, "");
  lines.push("## 模块6：标准工业级影视剧本", ep.module6_script, "");

  lines.push(
    "## 模块7：标准化分镜脚本表格",
    "| 镜号 | 单镜头时长(秒) | 景别 | 镜头运动 | 完整画面内容描述 | 人物动作/神态/穿搭配饰细节 | 画面同步台词/字幕 | 镜头整体情绪 | 适配BGM曲风 |",
    "|------|------|------|------|------|------|------|------|------|",
  );
  for (const s of ep.module7_storyboard) {
    lines.push(
      `| ${s.frameIndex} | ${s.duration} | ${s.shotSize} | ${s.cameraMove} | ${s.description} | ${s.characterDetail} | ${s.dialogue} | ${s.emotion} | ${s.bgm} |`,
    );
  }
  lines.push("");

  lines.push("## 模块8：分镜图 AI 生成提示词");
  for (const p of ep.module8_imagePrompts) {
    lines.push(`- 镜${p.frameIndex}：${p.zh}`);
    lines.push(`- 镜${p.frameIndex}(EN)：${p.en}`);
  }
  lines.push("");

  lines.push("## 模块9：分镜视频成片统一渲染参数", ep.module9_videoParams, "");
  lines.push("## 模块10：本集视觉&剧情综合校验报告", ep.module10_editNotes, "");

  return lines.join("\n").trim();
}

export function renderScriptStudioBatchMarkdown(
  batch: ScriptStudioBatchJson,
): string {
  const parts: string[] = [];
  if (batch.frozenBibles) {
    parts.push(renderFrozenBiblesMarkdown(batch.frozenBibles));
  }
  if (batch.validationReport?.trim()) {
    parts.push(`## 篇章综合校验报告\n\n${batch.validationReport.trim()}`);
  }
  for (const ep of batch.episodes) {
    parts.push(renderEpisodeMarkdown(ep));
  }
  return parts.filter(Boolean).join("\n\n---\n\n").trim();
}

export function renderFrozenBiblesMarkdown(
  bibles: ScriptStudioFrozenBiblesJson,
): string {
  return [
    `## ${SCRIPT_STUDIO_BIBLE_FILES[0]}`,
    bibles.worldview,
    "",
    `## ${SCRIPT_STUDIO_BIBLE_FILES[1]}`,
    bibles.characters,
    "",
    `## ${SCRIPT_STUDIO_BIBLE_FILES[2]}`,
    bibles.scenes,
    "",
    `## ${SCRIPT_STUDIO_BIBLE_FILES[3]}`,
    bibles.synopsis,
  ]
    .join("\n")
    .trim();
}

/** 续批 prompt 用 compact JSON（frozen + 已完成集摘要） */
export function buildScriptStudioContinuationContext(args: {
  frozenBibles?: ScriptStudioFrozenBiblesJson | null;
  frozenBiblesMd?: string;
  completedCanonicalJson?: ScriptStudioBatchJson[] | null;
  system?: ScriptStudioSystem;
  totalEpisodes?: number;
}): string {
  const chunks: string[] = [];
  if (args.frozenBibles) {
    chunks.push(
      JSON.stringify({ frozenBibles: args.frozenBibles }),
    );
  } else if (args.frozenBiblesMd?.trim()) {
    chunks.push(
      JSON.stringify({ frozenBiblesMd: args.frozenBiblesMd.trim().slice(0, 12_000) }),
    );
  }
  if (args.completedCanonicalJson?.length) {
    const compact = args.completedCanonicalJson.map((batch) => ({
      batch: batch.batch,
      validationReport: batch.validationReport?.slice(0, 2000),
      episodes: batch.episodes.map((ep) => ({
        episodeNo: ep.episodeNo,
        title: ep.title,
        module1_base: ep.module1_base,
        module2_characters: ep.module2_characters.map((c) => ({
          name: c.name,
          outfit: c.outfit,
          episodeOutfit: c.episodeOutfit,
          emotion: c.emotion,
        })),
        module3_scenes: ep.module3_scenes.map((s) => ({
          name: s.name,
          intExt: s.intExt,
          time: s.time,
        })),
        module5_outline: ep.module5_outline.slice(0, 800),
        module1_cliffhanger: ep.module1_base.cliffhanger,
      })),
    }));
    chunks.push(JSON.stringify({ completedBatches: compact }));
  }
  return chunks.join("\n\n");
}

export type ScriptStudioJsonAggregate = ReturnType<
  typeof syncScriptStudioEpisodeToProRows
>;

/** 单批 JSON → 合并后的 Pro2 rows */
export function aggregateScriptStudioJsonBatchRows(
  batch: ScriptStudioBatchJson,
  hubId: string,
): {
  characters: ScriptStudioJsonAggregate["characters"];
  scenes: ScriptStudioJsonAggregate["scenes"];
  props: ScriptStudioJsonAggregate["props"];
  frames: ScriptStudioJsonAggregate["frames"];
  moods: ScriptStudioJsonAggregate["moods"];
  audios: ScriptStudioJsonAggregate["audios"];
} {
  const out = {
    characters: [] as ScriptStudioJsonAggregate["characters"],
    scenes: [] as ScriptStudioJsonAggregate["scenes"],
    props: [] as ScriptStudioJsonAggregate["props"],
    frames: [] as ScriptStudioJsonAggregate["frames"],
    moods: [] as ScriptStudioJsonAggregate["moods"],
    audios: [] as ScriptStudioJsonAggregate["audios"],
  };
  for (const epJson of batch.episodes) {
    const episode = scriptStudioJsonEpisodeToParseEpisode(epJson);
    const sync = syncScriptStudioEpisodeToProRows(episode, hubId);
    const mergeByKey = <T extends { key: string }>(a: T[], b: T[]) => {
      const map = new Map(a.map((r) => [r.key, r]));
      for (const row of b) map.set(row.key, { ...map.get(row.key), ...row });
      return Array.from(map.values());
    };
    out.characters = mergeByKey(out.characters, sync.characters);
    out.scenes = mergeByKey(out.scenes, sync.scenes);
    out.props = mergeByKey(out.props, sync.props);
    out.frames = mergeByKey(out.frames, sync.frames).sort(
      (a, b) => a.frameIndex - b.frameIndex,
    );
    out.moods = mergeByKey(out.moods, sync.moods);
    out.audios = mergeByKey(out.audios, sync.audios);
  }
  return out;
}

export function parseScriptStudioCanonicalJson(
  raw: unknown,
): ScriptStudioBatchJson[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is ScriptStudioBatchJson =>
        item != null && typeof item === "object" && "episodes" in item,
    );
  }
  if (typeof raw === "object" && "episodes" in (raw as object)) {
    return [raw as ScriptStudioBatchJson];
  }
  return [];
}
