/**
 * 剧本创作画布（script-studio）· AI 影视工业化标准化剧本生产提示词
 *
 * 真源文档：docs/2.0 工业标准化脚本生产.md
 * LLM 输出契约：```script-studio-batch``` JSON（见 data/script-studio-batch-schema.ts）
 *
 * book-mall 侧若复用须保持同步（Gateway clientPage: canvas/{projectId}/script-studio）。
 */

/** 体系：从零原创 / 原稿翻新 */
export type ScriptStudioSystem = "original" | "adaptation";

/** 生产单元固定 10 集一批 */
export const SCRIPT_STUDIO_BATCH_SIZE = 10;

/** 允许的总集数预设 */
export const SCRIPT_STUDIO_TOTAL_EPISODE_PRESETS = [
  5, 10, 20, 30, 40, 50,
] as const;
export type ScriptStudioTotalEpisodes =
  (typeof SCRIPT_STUDIO_TOTAL_EPISODE_PRESETS)[number];

export const SCRIPT_STUDIO_TOTAL_EPISODE_MIN = 1;
export const SCRIPT_STUDIO_TOTAL_EPISODE_MAX = 120;

/** 4 份永久冻结档案标题（首轮生成、后续禁止修改） */
export const SCRIPT_STUDIO_BIBLE_FILES = [
  "全剧精确年代&世界观完整档案",
  "全员完整版视觉人物档案",
  "全剧常驻场景资源库",
  "全集极简总纲",
] as const;

/** 计算批次数：ceil(totalEpisodes / 10) */
export function scriptStudioBatchCount(totalEpisodes: number): number {
  if (!Number.isFinite(totalEpisodes) || totalEpisodes <= 0) return 0;
  return Math.ceil(totalEpisodes / SCRIPT_STUDIO_BATCH_SIZE);
}

/** 第 batchIndex(从0起) 批的集数区间 [start, end]（含端点，1-based 集号） */
export function scriptStudioBatchRange(
  batchIndex: number,
  totalEpisodes: number,
): { start: number; end: number } {
  const start = batchIndex * SCRIPT_STUDIO_BATCH_SIZE + 1;
  const end = Math.min(
    (batchIndex + 1) * SCRIPT_STUDIO_BATCH_SIZE,
    totalEpisodes,
  );
  return { start, end };
}

/** 一、全局统一硬性强制规则（两套体系通用） */
export const SCRIPT_STUDIO_GLOBAL_RULES = `# 全局统一硬性强制规则（全程遵守，不可违背）

1. 三重永久锁死机制：4 份冻结档案首次生成后永久冻结，后续所有集数禁止修改
   - 时代世界观锁：年代、地域、建筑、道具、色调统一，杜绝时代穿帮
   - 人物视觉锁：五官、脸型、肤色、发型、穿搭、配饰、气质全程固定，禁止变脸/随意换装
   - 剧情总纲锁：全集一句话总纲为唯一基准，剧情不得擅自增删、偏离
2. 批量生产规则：固定 10 集为 1 个生产单元，单次仅生成 10 集内容，不一次性批量产出更多集数
3. 单集叙事硬性标准：本集独立矛盾完整闭环，仅结尾设置 1 个跨集长线悬念；
   完整叙事结构：开场钩子 → 主线推进 → 支线互动 → 中段反转 → 本集矛盾收尾 → 预埋下集悬念
4. 输出强制要求：每一集严格输出 10 大固定模块，顺序固定、字段填满、禁止简写缺项；
   分镜时长精确到秒、分镜提示词使用固定拼接公式、视频渲染参数标准化
5. 批次校验规则：每完成 10 集必须输出篇章综合校验报告（人设 OOC / 剧情偏离 / 视觉错乱 / 叙事残缺）并给可落地修改方案`;

/**
 * JSON 字段契约（替代 GFM 表头 · 供 LLM 与 Zod 校验）
 */
export const SCRIPT_STUDIO_JSON_FIELD_RULES = `# script-studio-batch JSON 契约（唯一输出格式）

围栏标记：\`\`\`script-studio-batch

顶层字段：
- schemaVersion: 1（固定）
- action: "first_round_with_bibles"（首轮）| "batch_complete"（续批）
- system: "original" | "adaptation"
- batch: { startEpisode, endEpisode, totalEpisodes }
- frozenBibles?（首轮必填）: { worldview, characters, scenes, synopsis } — 对应 4 份永久冻结档案全文
- validationReport?（可选）: 本批篇章综合校验报告字符串
- episodes[]: 本批每一集完整 10 模块

episodes[] 每集字段（顺序固定、禁止缺项）：
- episodeNo: 集号（整数）
- title?: 集标题
- module1_base: { episodeNo, standardDuration, coreTheme, prevEpisodeHook, conflictClosure, cliffhanger }
- module2_characters[]: 每人 { name, age, bodyType, faceShape, facialFeatures, temperament, skin, hair, outfit, accessories, episodeOutfit, emotion, behavior, speechStyle }
- module3_scenes[]: 每场景 { name, intExt, time, decor, lighting, mood, props, ambientSound }
- module4_props[]: 每件 { name, type, role, texture, placement, eraOk, closeUp }（无道具可 []）
- module5_outline: 8 要素结构化大纲（字符串）
- module6_script: 标准工业级影视剧本文本（字符串）
- module7_storyboard[]: 每镜 { frameIndex, duration, shotSize, cameraMove, description, characterDetail, dialogue, emotion, bgm }
- module8_imagePrompts[]: 每镜 { frameIndex, zh, en } — zh 中文拼接公式、en 英文生图 prompt，镜号与 module7 一一对应
- module9_videoParams: 分镜视频成片统一渲染参数（字符串）
- module10_editNotes: 本集视觉&剧情综合校验报告（字符串）

硬性要求：
- **只输出** \`\`\`script-studio-batch\`\`\` JSON 围栏，禁止 GFM 表格/Markdown 章节/说明文字
- 每集 module2/module3/module7/module8 非空；module8 每镜 zh 与 en 成对
- 分镜 duration 精确到秒；module8 zh 按固定拼接公式（画风+年代+人物+穿搭+场景+景别运镜+氛围+材质+8K）
- 禁止 JSON 尾逗号与 // 注释`;

/** @deprecated 仅供旧 MD 项目只读解析；新批次走 JSON */
export const SCRIPT_STUDIO_MODULE_SPEC = SCRIPT_STUDIO_JSON_FIELD_RULES;

type FirstRoundArgs = {
  system: ScriptStudioSystem;
  totalEpisodes: number;
  genre?: string;
  rawScript?: string;
};

type ContinuationArgs = {
  system: ScriptStudioSystem;
  totalEpisodes: number;
  batchStart: number;
  batchEnd: number;
  chapterLabel?: string;
  rawScript?: string;
  /** 续批上下文：compact JSON（frozen + 已完成集摘要） */
  continuationContext?: string;
};

/** 首轮提示词（生成 4 冻结档案 + 第 1-10 集） */
export function buildScriptStudioFirstRoundPrompt(args: FirstRoundArgs): string {
  const total = args.totalEpisodes;
  const { end } = scriptStudioBatchRange(0, total);
  const jsonHint = `
输出格式：\`\`\`script-studio-batch
{
  "schemaVersion": 1,
  "action": "first_round_with_bibles",
  "system": "${args.system}",
  "batch": { "startEpisode": 1, "endEpisode": ${end}, "totalEpisodes": ${total} },
  "frozenBibles": { "worldview": "…", "characters": "…", "scenes": "…", "synopsis": "…" },
  "validationReport": "…",
  "episodes": [ … ]
}
\`\`\`

${SCRIPT_STUDIO_JSON_FIELD_RULES}`;

  if (args.system === "original") {
    return `你是资深工业影视总编剧，执行全流程标准化原创剧集创作，总集数：${total}，本次仅生产第 1-${end} 集，严格遵守《全局统一硬性强制规则》，全程杜绝人设漂移、剧情断层、视觉形象错乱、年代穿帮。

${SCRIPT_STUDIO_GLOBAL_RULES}

第一步，在 frozenBibles 中写入 4 份永久冻结存档（后续所有集数创作禁止修改）：
- worldview → ${SCRIPT_STUDIO_BIBLE_FILES[0]}
- characters → ${SCRIPT_STUDIO_BIBLE_FILES[1]}
- scenes → ${SCRIPT_STUDIO_BIBLE_FILES[2]}
- synopsis → ${SCRIPT_STUDIO_BIBLE_FILES[3]}（完整 ${total} 集每集 1 句话）

第二步，episodes[] 写入第 1-${end} 集逐集完整 10 模块 JSON，不得缺项简写。

第三步，validationReport 汇总 1-${end} 集篇章校验（人设 OOC / 剧情偏离 / 视觉错乱 / 叙事残缺 + 修改方案）。

创作题材与风格：${args.genre?.trim() || "（请补充题材与风格）"}
${jsonHint}`;
  }

  return `本次执行原稿工业化精修流水线工程，最高铁律：用户提供原始原稿内全部主线剧情、人物关系、核心冲突、关键名场面、故事结局完全禁止修改，仅做内容规整、逻辑润色、视觉统一、标准化结构化输出。
总集数：${total}，本次仅处理原稿对应第 1-${end} 集内容，严格遵守《全局统一硬性强制规则》。

${SCRIPT_STUDIO_GLOBAL_RULES}

第一步，基于原稿在 frozenBibles 提取 4 份永久冻结存档。
第二步，episodes[] 基于原稿逐集规整第 1-${end} 集 10 模块 JSON，不新增原创主线。
第三步，validationReport 输出篇章校验优化清单。

补充题材/风格说明：${args.genre?.trim() || "（可选）"}

下方为第 1-${end} 集原始原稿素材：
${args.rawScript?.trim() || "【请粘贴你的原始剧本/故事文稿】"}
${jsonHint}`;
}

/** 次轮接续提示词（11-20 集… 多批次通用） */
export function buildScriptStudioContinuationPrompt(
  args: ContinuationArgs,
): string {
  const { batchStart, batchEnd, totalEpisodes, chapterLabel } = args;
  const prevEnd = batchStart - 1;
  const chapter = chapterLabel?.trim() || "本篇章";
  const jsonHint = `
输出格式：\`\`\`script-studio-batch
{
  "schemaVersion": 1,
  "action": "batch_complete",
  "system": "${args.system}",
  "batch": { "startEpisode": ${batchStart}, "endEpisode": ${batchEnd}, "totalEpisodes": ${totalEpisodes} },
  "validationReport": "…",
  "episodes": [ … ]
}
\`\`\`

${SCRIPT_STUDIO_JSON_FIELD_RULES}`;

  const contextBlock = args.continuationContext?.trim()
    ? `【已完成批次结构化摘要 · 须严格对齐，禁止修改 frozenBibles】\n${args.continuationContext.trim()}`
    : "";

  const frozenHeader = contextBlock
    ? contextBlock
    : `【顶部置顶永久冻结文件，禁止删除/修改】
1. ${SCRIPT_STUDIO_BIBLE_FILES[0]}
2. ${SCRIPT_STUDIO_BIBLE_FILES[1]}
3. ${SCRIPT_STUDIO_BIBLE_FILES[2]}
4. ${SCRIPT_STUDIO_BIBLE_FILES[3]}
5. 已完成批次：1-${prevEnd} 集全部 10 模块`;

  if (args.system === "original") {
    return `${frozenHeader}

本次生产单元：第 ${batchStart}-${batchEnd} 集（总集数 ${totalEpisodes}），严格遵守《全局统一硬性强制规则》，全程对齐全部冻结档案，杜绝任何剧情、人设、视觉漂移。

强制约束：
1. 人物视觉 100% 复刻前序标准；2. 场景年代/光影/道具统一；3. 剧情对齐全集极简总纲；
4. 承接第 ${prevEnd} 集结尾；5. 每集 episodes[] 含完整 10 模块；6. 单集独立闭环 + 1 个跨集悬念。

${SCRIPT_STUDIO_GLOBAL_RULES}

本次输出：
1. ${chapter}主题概述（可写入 validationReport 开头）；
2. episodes[] 第 ${batchStart}-${batchEnd} 集；
3. validationReport：1-${batchEnd} 集全局综合校验。
${jsonHint}`;
  }

  return `${frozenHeader}

本次处理原稿对应集数：第 ${batchStart}-${batchEnd} 集（总集数 ${totalEpisodes}）。最高约束：核心剧情完全忠于原始原稿。

${SCRIPT_STUDIO_GLOBAL_RULES}

本次输出 episodes[] 第 ${batchStart}-${batchEnd} 集 + validationReport。

下方为第 ${batchStart}-${batchEnd} 集原始原稿素材：
${args.rawScript?.trim() || "【请粘贴本批原始原稿素材】"}
${jsonHint}`;
}

/** 体系展示文案 */
export function scriptStudioSystemLabel(system: ScriptStudioSystem): string {
  return system === "original" ? "从零原创（无原稿）" : "原稿翻新（已有原稿）";
}
