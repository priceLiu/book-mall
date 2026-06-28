/**
 * 剧本创作画布（script-studio）· AI 影视工业化标准化剧本生产提示词
 *
 * 真源文档：docs/2.0 工业标准化脚本生产.md
 * 两套体系：
 *   - original   从零原创无原稿版
 *   - adaptation 已有原稿翻新规整版
 * 生产单元固定 10 集/批（60 集 = 6 批），解决长剧人设/剧情/视觉漂移问题。
 * 首轮额外生成 4 份永久冻结档案；次轮接续须置顶冻结档案 + 已完成批次成品。
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
 * 二、单集 10 大固定输出模块标准细则。
 *
 * 机器可解析约束（剧本创作画布解析器依赖，务必严格遵守）：
 * - 每一集以一级标题 `# 第N集` 开头（N 为阿拉伯数字）。
 * - 模块均以二级标题 `## 模块X：标题` 开头（X 为 1~10）。
 * - 模块 2 / 3 / 4 / 7 必须输出 **GFM 表格**，表头列名与下方完全一致、顺序不可改、不可空字段。
 * - 模块 1 / 5 / 6 / 8 / 9 / 10 为结构化正文（非表格）。
 */
export const SCRIPT_STUDIO_MODULE_SPEC = `# 单集 10 大固定输出模块（顺序不可调换、字段不可删减、禁止简写缺项）

【排版硬规则 · 供后续工作流解析，务必遵守】
- 每一集以一级标题开头：\`# 第N集\`（N 为阿拉伯数字，如「# 第1集」）
- 每个模块以二级标题开头：\`## 模块X：标题\`
- 模块 2 / 3 / 4 / 7 必须输出 GFM 表格，**表头列名、顺序与下方完全一致**，每格填满，禁止合并/缺列

## 模块1：本集基础档案（结构化正文）
- 集数 / 单集标准时长 / 本集核心主题 / 承接上一集结尾剧情 / 本集独立矛盾闭环结果 / 本集唯一跨集结尾悬念

## 模块2：本集出场人物完整版视觉锁定复盘（GFM 表 · 每人一行 · 12 项严格匹配全局人物档案）
| 姓名 | 年龄 | 身高体型 | 脸型骨相 | 五官细节 | 神态气质 | 皮肤质感 | 发型体系 | 全套穿搭 | 固定配饰 | 本集临时穿搭 | 本集情绪 | 行为逻辑 | 台词风格 |
|------|------|------|------|------|------|------|------|------|------|------|------|------|------|

## 模块3：本集场景完整环境档案（GFM 表 · 每个场景一行）
| 场景名称 | 内外景 | 时间区间 | 年代装修布局 | 光影参数 | 环境氛围 | 常驻道具 | 背景音效 |
|------|------|------|------|------|------|------|------|

## 模块4：本集道具精细化清单（GFM 表 · 每件道具一行）
| 道具名称 | 类型 | 剧情作用 | 质感/新旧 | 摆放/手持位置 | 年代合规 | 是否特写 |
|------|------|------|------|------|------|------|
- 类型：核心剧情道具 / 氛围辅助装饰道具
- 是否特写：是 / 否

## 模块5：本集结构化完整大纲（固定 8 要素 · 结构化正文）
- 1 上一集承接 · 2 开场3秒钩子 · 3 主线推进 · 4 支线互动 · 5 中段冲突反转 · 6 本集矛盾闭环 · 7 新增长线伏笔 · 8 结尾次集悬念

## 模块6：标准工业级影视剧本（固定单行排版 · 结构化正文）
- 【场景序号】内外景+时间｜环境光影｜空间陈设与道具｜人物进场动作/神态｜完整台词｜(情绪)｜本段功能：铺垫/冲突/反转/收尾

## 模块7：标准化分镜脚本表格（GFM 表 · 固定表头 · 无空白字段 · 时长精确到秒）
| 镜号 | 单镜头时长(秒) | 景别 | 镜头运动 | 完整画面内容描述 | 人物动作/神态/穿搭配饰细节 | 画面同步台词/字幕 | 镜头整体情绪 | 适配BGM曲风 |
|------|------|------|------|------|------|------|------|------|
- 景别：全景/中全景/中景/近景/特写/大特写
- 镜头运动：固定/慢推/拉/左右横摇/跟随移动/环绕/慢移

## 模块8：分镜图 AI 生成提示词（固定拼接公式，顺序不可打乱 · 每镜严格输出两行）
中文拼接公式（固定顺序）：全剧统一固定画风词 + 全剧统一年代环境质感 + 人物完整五官脸型神态 + 人物本集固定穿搭+全套配饰 + 当前完整场景环境光影 + 本镜头景别+镜头运动参数 + 画面整体氛围关键词 + 材质细节质感 + 高清画质参数(8K、电影级、细腻光影)
- 第一行（中文，供人工审阅）：\`镜N：<按上述公式拼接的中文提示词>\`
- 第二行（英文，供 AI 生图直接调用）：\`镜N(EN)：<the same prompt as a single-line English image-generation prompt>\`
- N 为分镜表镜号，须与模块7 一一对应；两行成对、缺一不可

## 模块9：分镜视频成片统一渲染参数（结构化正文）
- 固定视频画幅(16:9 / 9:16) / 统一滤镜色调饱和度明暗 / 字幕规范 / 转场统一风格 / 节奏标准 / BGM 使用规则

## 模块10：本集视觉&剧情综合校验报告（结构化正文）
- 人物校验 / 场景校验 / 剧情校验(总纲对齐/OOC/闭环/伏笔呼应) / 优化调整建议`;

type FirstRoundArgs = {
  system: ScriptStudioSystem;
  totalEpisodes: number;
  /** 题材与风格（从零原创必填；原稿翻新可作补充说明） */
  genre?: string;
  /** 原稿翻新：第 1-10 集原始原稿素材 */
  rawScript?: string;
};

type ContinuationArgs = {
  system: ScriptStudioSystem;
  totalEpisodes: number;
  /** 本批集数区间 */
  batchStart: number;
  batchEnd: number;
  /** 篇章序号文案（如「第二篇章」），可空 */
  chapterLabel?: string;
  /** 原稿翻新：本批原始原稿素材 */
  rawScript?: string;
};

/** 首轮提示词（生成 4 冻结档案 + 第 1-10 集） */
export function buildScriptStudioFirstRoundPrompt(args: FirstRoundArgs): string {
  const total = args.totalEpisodes;
  const { end } = scriptStudioBatchRange(0, total);
  if (args.system === "original") {
    return `你是资深工业影视总编剧，执行全流程标准化原创剧集创作，总集数：${total}，本次仅生产第 1-${end} 集，严格遵守《全局统一硬性强制规则》，全程杜绝人设漂移、剧情断层、视觉形象错乱、年代穿帮。

${SCRIPT_STUDIO_GLOBAL_RULES}

第一步，优先生成 4 份永久冻结存档文件，后续所有集数创作禁止修改：
文件1：${SCRIPT_STUDIO_BIBLE_FILES[0]}（精确年份、地域质感、时代氛围、社会习惯、建筑街道风格、固定道具规范、统一基础色调、禁止年代错位物品与穿搭）
文件2：${SCRIPT_STUDIO_BIBLE_FILES[1]}（所有主线/重要配角统一 12 项视觉字段，永久锁定，不得改动）
文件3：${SCRIPT_STUDIO_BIBLE_FILES[2]}（每个常驻场景完整输出：名称/内外景/标准时间/年代装修/固定光影/环境氛围/常驻道具/背景音效/画面质感）
文件4：${SCRIPT_STUDIO_BIBLE_FILES[3]}（完整 ${total} 集，每集 1 句话核心剧情，标注每 10 集篇章小高潮、重大剧情拐点、关键伏笔埋设集数；为全剧唯一剧情基准）

第二步，生成第 1-${end} 集逐集完整工业化内容，每一集严格按顺序输出 10 大固定模块，不得缺项简写：

${SCRIPT_STUDIO_MODULE_SPEC}

第三步，汇总输出 1-${end} 集整体篇章校验报告，统一筛查人物视觉偏差、人设 OOC、剧情偏离、年代穿帮、单集叙事残缺问题，并给出逐条可落地修改方案。

创作题材与风格：${args.genre?.trim() || "（请补充题材与风格）"}`;
  }

  // adaptation · 原稿翻新
  return `本次执行原稿工业化精修流水线工程，最高铁律：用户提供原始原稿内全部主线剧情、人物关系、核心冲突、关键名场面、故事结局完全禁止修改，仅做内容规整、逻辑润色、视觉统一、标准化结构化输出。
总集数：${total}，本次仅处理原稿对应第 1-${end} 集内容，严格遵守《全局统一硬性强制规则》。

${SCRIPT_STUDIO_GLOBAL_RULES}

第一步，基于原稿提取生成 4 份永久冻结存档文件，后续批次不可修改：
文件1：${SCRIPT_STUDIO_BIBLE_FILES[0]}（年代/环境/道具规范从原稿提炼，统一时代视觉标准）
文件2：${SCRIPT_STUDIO_BIBLE_FILES[1]}（基于原稿还原每个人物 12 项视觉固定字段，修复原稿前后形象混乱）
文件3：${SCRIPT_STUDIO_BIBLE_FILES[2]}（提取原稿所有出场场景，统一光影/年代装修/道具摆放标准）
文件4：${SCRIPT_STUDIO_BIBLE_FILES[3]}（完全依照原稿剧情梳理，作为唯一基准，不得偏离原稿总纲）

第二步，基于原稿逐集规整第 1-${end} 集内容，每一集严格按顺序输出 10 大固定模块，不缺项、不简写、不新增原创主线剧情：

${SCRIPT_STUDIO_MODULE_SPEC}

第三步，输出 1-${end} 集篇章整体校验优化清单（标注原稿原生逻辑漏洞、人设前后冲突、视觉不统一，给微调方案，不改主线）。

补充题材/风格说明：${args.genre?.trim() || "（可选）"}

下方为第 1-${end} 集原始原稿素材：
${args.rawScript?.trim() || "【请粘贴你的原始剧本/故事文稿】"}`;
}

/** 次轮接续提示词（11-20 集… 多批次通用） */
export function buildScriptStudioContinuationPrompt(
  args: ContinuationArgs,
): string {
  const { batchStart, batchEnd, totalEpisodes, chapterLabel } = args;
  const prevEnd = batchStart - 1;
  const frozenHeader = `【顶部置顶永久冻结文件，禁止删除/修改】
1. ${SCRIPT_STUDIO_BIBLE_FILES[0]}
2. ${SCRIPT_STUDIO_BIBLE_FILES[1]}
3. ${SCRIPT_STUDIO_BIBLE_FILES[2]}
4. ${SCRIPT_STUDIO_BIBLE_FILES[3]}
5. 已完成批次全套成品：1-${prevEnd} 集全部 10 模块完整内容 + 篇章校验报告`;
  const chapter = chapterLabel?.trim() || "本篇章";

  if (args.system === "original") {
    return `${frozenHeader}

本次生产单元：第 ${batchStart}-${batchEnd} 集（总集数 ${totalEpisodes}），严格遵守《全局统一硬性强制规则》，全程对齐全部冻结档案，杜绝任何剧情、人设、视觉漂移。

强制约束条款：
1. 所有出场人物五官/脸型/肤色/发型/穿搭/全套配饰/气质 100% 复刻前序标准，禁止形象改动；
2. 全部场景年代装修/光影色调/道具/环境音效与前序内容完全统一，无时代穿帮；
3. 所有剧情节点严格对齐全集极简总纲，不得删减/篡改既定关键事件；
4. 承接第 ${prevEnd} 集结尾全部剧情，完整呼应前序埋设的长线伏笔，新增伏笔贴合后续规划；
5. 每集完整顺序输出 10 大固定模块，严格遵循模块细则、表格格式、分镜提示词固定公式；
6. 单集叙事独立闭环，仅结尾设置 1 个跨集悬念，不得搁置本集核心矛盾。

${SCRIPT_STUDIO_MODULE_SPEC}

本次输出内容顺序：
1. ${chapter}主题概述、核心冲突、中期拐点、收尾铺垫；
2. 第 ${batchStart}-${batchEnd} 集逐集全套 10 模块工业化标准内容；
3. 1-${batchEnd} 集全局综合校验报告，标注所有人设/视觉/剧情漏洞，配套逐条修改清单。`;
  }

  // adaptation 续批
  return `${frozenHeader}

本次处理原稿对应集数：第 ${batchStart}-${batchEnd} 集（总集数 ${totalEpisodes}）。最高约束：所有核心剧情、人物设定完全忠于原始原稿，禁止原创主线、删减原稿关键桥段。

硬性统一规范：
1. 人物全套视觉形象严格匹配全局人物档案，杜绝形象漂移、穿搭配饰随意改动；
2. 场景光影/年代道具/环境风格与前序完全统一；
3. 剧情严格对齐全集原稿总纲，承接第 ${prevEnd} 集结尾，回收前序所有伏笔；
4. 每集完整输出 10 大标准模块，表格/分镜提示词/视频参数严格遵循固定格式；
5. 修补原稿叙事残缺/过渡断层，仅补充细节，不新增原创冲突事件。

${SCRIPT_STUDIO_MODULE_SPEC}

本次输出内容：
1. ${chapter}主题与剧情走向概述；
2. 第 ${batchStart}-${batchEnd} 集逐集全套标准化 10 模块内容；
3. 1-${batchEnd} 集全局综合校验优化清单。

下方为第 ${batchStart}-${batchEnd} 集原始原稿素材：
${args.rawScript?.trim() || "【请粘贴本批原始原稿素材】"}`;
}

/** 体系展示文案 */
export function scriptStudioSystemLabel(system: ScriptStudioSystem): string {
  return system === "original" ? "从零原创（无原稿）" : "原稿翻新（已有原稿）";
}
