/**
 * 剧本创作画布（script-studio）· 新工业化设计的解析层
 *
 * 真源文档：docs/2.0 工业标准化脚本生产.md
 * 输出契约见 script-studio-prompts.ts · SCRIPT_STUDIO_MODULE_SPEC：
 *   - 每集以 `# 第N集` 开头
 *   - 每模块以 `## 模块X：标题` 开头
 *   - 模块 2 / 3 / 4 / 7 为固定表头 GFM 表
 *   - 模块 8 为每镜一行的拼接公式（以「镜N：」开头）
 *
 * 本层只做「文档 → 结构化行」的纯解析，不依赖 React / store，便于单测。
 * 旧版四表解析（parse-md-tables 的 outline/character/scene 流程）不在此复用。
 */

import { parseMdTable, prepareMarkdownForTableParse } from "./parse-md-tables";

/** 模块2：单集人物视觉锁定（12 项 + 姓名/年龄 = 14 列） */
export type ScriptStudioCharacterLock = {
  name: string;
  age: string;
  bodyType: string;
  faceShape: string;
  facialFeatures: string;
  temperament: string;
  skin: string;
  hair: string;
  outfit: string;
  accessories: string;
  episodeOutfit: string;
  emotion: string;
  behavior: string;
  speechStyle: string;
};

/** 模块3：单集场景环境档案 */
export type ScriptStudioSceneArchive = {
  name: string;
  intExt: string;
  time: string;
  decor: string;
  lighting: string;
  mood: string;
  props: string;
  ambientSound: string;
};

/** 模块4：单集道具清单 */
export type ScriptStudioPropItem = {
  name: string;
  type: string;
  role: string;
  texture: string;
  placement: string;
  eraOk: string;
  closeUp: string;
};

/** 模块7（+模块8 拼接）：单集分镜 */
export type ScriptStudioShot = {
  frameIndex: number;
  duration: string;
  shotSize: string;
  cameraMove: string;
  description: string;
  characterDetail: string;
  dialogue: string;
  emotion: string;
  bgm: string;
  /** 模块8 英文版分镜图提示词（供 AI 生图调用 · 按镜号匹配） */
  imagePrompt: string;
  /** 模块8 中文拼接公式（供人工审阅展示 · 按镜号匹配） */
  imagePromptZh: string;
};

export type ScriptStudioEpisode = {
  episodeNo: number;
  title: string;
  characters: ScriptStudioCharacterLock[];
  scenes: ScriptStudioSceneArchive[];
  props: ScriptStudioPropItem[];
  shots: ScriptStudioShot[];
};

export type ScriptStudioBatch = {
  episodes: ScriptStudioEpisode[];
};

function pick(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    for (const [key, val] of Object.entries(row)) {
      const nk = key.trim().toLowerCase().replace(/\s+/g, " ");
      if (nk === a || nk.includes(a)) return (val ?? "").trim();
    }
  }
  return "";
}

function toFrameIndex(raw: string, fallback: number): number {
  const n = parseInt(String(raw).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 将整批文档按 `# 第N集` 切成各集（容错：第N集 / 第N话 / 第N章） */
export function splitScriptStudioEpisodes(
  md: string,
): Array<{ episodeNo: number; title: string; body: string }> {
  const lines = (md ?? "").split(/\r?\n/);
  const heads: Array<{ idx: number; episodeNo: number; title: string }> = [];
  const headRe = /^#\s*第\s*(\d+)\s*[集话話章节節]\s*(.*)$/;
  lines.forEach((line, idx) => {
    const m = line.trim().match(headRe);
    if (m) {
      heads.push({
        idx,
        episodeNo: parseInt(m[1]!, 10),
        title: (m[2] ?? "").trim(),
      });
    }
  });
  if (!heads.length) return [];
  const out: Array<{ episodeNo: number; title: string; body: string }> = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i]!.idx + 1;
    const end = i + 1 < heads.length ? heads[i + 1]!.idx : lines.length;
    out.push({
      episodeNo: heads[i]!.episodeNo,
      title: heads[i]!.title,
      body: lines.slice(start, end).join("\n").trim(),
    });
  }
  return out;
}

/** 将一集正文按 `## 模块X：…` 切成 {moduleIndex: body} */
export function splitScriptStudioModules(body: string): Map<number, string> {
  const lines = (body ?? "").split(/\r?\n/);
  const heads: Array<{ idx: number; mod: number }> = [];
  const headRe = /^#{2,3}\s*模块\s*(\d+)\s*[：:].*$/;
  lines.forEach((line, idx) => {
    const m = line.trim().match(headRe);
    if (m) heads.push({ idx, mod: parseInt(m[1]!, 10) });
  });
  const map = new Map<number, string>();
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i]!.idx + 1;
    const end = i + 1 < heads.length ? heads[i + 1]!.idx : lines.length;
    map.set(heads[i]!.mod, lines.slice(start, end).join("\n").trim());
  }
  return map;
}

export function parseScriptStudioCharacterLocks(
  moduleMd: string,
): ScriptStudioCharacterLock[] {
  if (!moduleMd?.trim()) return [];
  const { rows } = parseMdTable(prepareMarkdownForTableParse(moduleMd));
  return rows
    .map((r) => ({
      name: pick(r, ["姓名", "name", "角色"]),
      age: pick(r, ["年龄", "age"]),
      bodyType: pick(r, ["身高体型", "身高", "体型", "体态"]),
      faceShape: pick(r, ["脸型骨相", "脸型", "骨相"]),
      facialFeatures: pick(r, ["五官细节", "五官"]),
      temperament: pick(r, ["神态气质", "气质", "神态"]),
      skin: pick(r, ["皮肤质感", "皮肤", "肤色"]),
      hair: pick(r, ["发型体系", "发型", "发色"]),
      outfit: pick(r, ["全套穿搭", "穿搭体系", "穿搭", "服装"]),
      accessories: pick(r, ["固定配饰", "配饰"]),
      episodeOutfit: pick(r, ["本集临时穿搭", "临时穿搭", "本集穿搭"]),
      emotion: pick(r, ["本集情绪", "情绪状态", "情绪"]),
      behavior: pick(r, ["行为逻辑", "处事逻辑", "行为"]),
      speechStyle: pick(r, ["台词风格", "口头禅", "台词"]),
    }))
    .filter((c) => c.name);
}

export function parseScriptStudioScenes(
  moduleMd: string,
): ScriptStudioSceneArchive[] {
  if (!moduleMd?.trim()) return [];
  const { rows } = parseMdTable(prepareMarkdownForTableParse(moduleMd));
  return rows
    .map((r) => ({
      name: pick(r, ["场景名称", "场景名", "场景", "scene"]),
      intExt: pick(r, ["内外景", "内景/外景", "int/ext"]),
      time: pick(r, ["时间区间", "时间", "time"]),
      decor: pick(r, ["年代装修布局", "装修布局", "陈设", "布局"]),
      lighting: pick(r, ["光影参数", "光影", "光线"]),
      mood: pick(r, ["环境氛围", "氛围", "气氛", "mood"]),
      props: pick(r, ["常驻道具", "道具"]),
      ambientSound: pick(r, ["背景音效", "环境音效", "音效", "声音"]),
    }))
    .filter((s) => s.name);
}

export function parseScriptStudioProps(
  moduleMd: string,
): ScriptStudioPropItem[] {
  if (!moduleMd?.trim()) return [];
  const { rows } = parseMdTable(prepareMarkdownForTableParse(moduleMd));
  return rows
    .map((r) => ({
      name: pick(r, ["道具名称", "道具名", "道具", "name"]),
      type: pick(r, ["类型", "type"]),
      role: pick(r, ["剧情作用", "作用", "用途"]),
      texture: pick(r, ["质感/新旧", "质感", "新旧"]),
      placement: pick(r, ["摆放/手持位置", "摆放位置", "位置", "手持位置"]),
      eraOk: pick(r, ["年代合规", "合规"]),
      closeUp: pick(r, ["是否特写", "特写"]),
    }))
    .filter((p) => p.name);
}

/**
 * 模块8：每镜两行 → frameIndex → { zh, en }
 *   中文行：`镜N：<中文公式>`
 *   英文行：`镜N(EN)：<English>`
 */
export function parseScriptStudioImagePrompts(
  moduleMd: string,
): Map<number, { zh: string; en: string }> {
  const map = new Map<number, { zh: string; en: string }>();
  if (!moduleMd?.trim()) return map;
  // 英文行须先于中文行匹配（中文正则要求数字后紧跟冒号，不会误吞 (EN) 行）
  const enRe = /^[-*\s]*镜\s*(\d+)\s*[（(]\s*EN\s*[)）]\s*[：:]\s*(.+)$/i;
  const zhRe = /^[-*\s]*镜\s*(\d+)\s*[：:]\s*(.+)$/;
  for (const raw of moduleMd.split(/\r?\n/)) {
    const line = raw.trim();
    const en = line.match(enRe);
    if (en) {
      const idx = parseInt(en[1]!, 10);
      const prompt = en[2]!.trim();
      if (Number.isFinite(idx) && prompt) {
        const cur = map.get(idx) ?? { zh: "", en: "" };
        map.set(idx, { ...cur, en: prompt });
      }
      continue;
    }
    const zh = line.match(zhRe);
    if (zh) {
      const idx = parseInt(zh[1]!, 10);
      const prompt = zh[2]!.trim();
      if (Number.isFinite(idx) && prompt) {
        const cur = map.get(idx) ?? { zh: "", en: "" };
        map.set(idx, { ...cur, zh: prompt });
      }
    }
  }
  return map;
}

export function parseScriptStudioShots(
  module7Md: string,
  module8Md = "",
): ScriptStudioShot[] {
  if (!module7Md?.trim()) return [];
  const { rows } = parseMdTable(prepareMarkdownForTableParse(module7Md));
  const imagePrompts = parseScriptStudioImagePrompts(module8Md);
  return rows
    .map((r, i) => {
      const frameIndex = toFrameIndex(
        pick(r, ["镜号", "镜头编号", "编号"]),
        i + 1,
      );
      return {
        frameIndex,
        duration: pick(r, ["单镜头时长(秒)", "时长(秒)", "时长", "duration"]),
        shotSize: pick(r, ["景别", "shot size"]),
        cameraMove: pick(r, ["镜头运动", "运镜", "camera"]),
        description: pick(r, ["完整画面内容描述", "画面内容描述", "画面描述", "画面"]),
        characterDetail: pick(r, [
          "人物动作/神态/穿搭配饰细节",
          "人物动作",
          "人物细节",
        ]),
        dialogue: pick(r, ["画面同步台词/字幕", "台词/字幕", "台词", "对白", "字幕"]),
        emotion: pick(r, ["镜头整体情绪", "整体情绪", "情绪"]),
        bgm: pick(r, ["适配bgm曲风", "适配bgm", "bgm", "配乐"]),
        imagePrompt: imagePrompts.get(frameIndex)?.en ?? "",
        imagePromptZh: imagePrompts.get(frameIndex)?.zh ?? "",
      };
    })
    .sort((a, b) => a.frameIndex - b.frameIndex);
}

export function parseScriptStudioEpisode(
  episodeNo: number,
  title: string,
  body: string,
): ScriptStudioEpisode {
  const modules = splitScriptStudioModules(body);
  return {
    episodeNo,
    title,
    characters: parseScriptStudioCharacterLocks(modules.get(2) ?? ""),
    scenes: parseScriptStudioScenes(modules.get(3) ?? ""),
    props: parseScriptStudioProps(modules.get(4) ?? ""),
    shots: parseScriptStudioShots(modules.get(7) ?? "", modules.get(8) ?? ""),
  };
}

/** 解析一批（≤10 集）工业化剧本文档为结构化数据 */
export function parseScriptStudioBatch(md: string): ScriptStudioBatch {
  const episodes = splitScriptStudioEpisodes(md).map((ep) =>
    parseScriptStudioEpisode(ep.episodeNo, ep.title, ep.body),
  );
  return { episodes };
}
