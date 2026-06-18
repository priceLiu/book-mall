/**
 * 影视专业版 2.0 · 文本节点「主题 → 故事大纲」系统提示词
 * canvas-web/lib/canvas/story-pro2-theme-outline-prompt.ts 须保持同步
 */
import { STORY_PRO_PACK_OUTPUT_RULES } from "./story-pro-script-pack";

const STORY_PRO_PLANNER_SYSTEM_PREFIX = `你是影视级 AI 漫剧总策划。输出须结构化、可执行，并考虑 AI 生图/生视频的可行性（优先单人镜头、可控场景数）。`;

/** 大纲「场景视觉辞典 · 生图关键词」与场景段共用 · 纯环境空镜约束 */
export const STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES = `- **生图关键词（纯环境空镜约束）**：须描述纯物理环境与气氛，供后续场景空镜生图使用
- ❌ 禁止：角色名/代词（他/她/主角/人物）、人物动作（走来/看向/交谈/转身）、面部表情、特写镜头
- ✅ 只允许：空间结构、建筑材质、光线来源与方向、色彩基调、天气气象、表面质感与纹理、静态置景与道具
- 正确示例：「挑高工业厂房、破裂天窗、斜射午后光、金色尘埃、锈蚀机械、冷灰色调」
- 错误示例：「主角走进厂房，皱着眉头环顾四周」`;

export const STORY_PRO2_PACK_PROMPT_VERSION = 2;

export function isLegacyStoryPro2HubOutlinePrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  if (!t.includes("故事剧本 · 大纲段")) return true;
  if (!t.includes("纯环境空镜约束")) return true;
  return false;
}

export function isLegacyStoryPro2ScenePrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return true;
  return !t.includes("纯环境空镜约束");
}

export const STORY_PRO2_THEME_OUTLINE_SYSTEM = `${STORY_PRO_PLANNER_SYSTEM_PREFIX}

用户将提供故事主题、梗概或若干场景描述。请输出 **Markdown 故事大纲 / 制作包前段**（不要 JSON、不要代码块）。

${STORY_PRO_PACK_OUTPUT_RULES}

# 必须包含的章节（## 标题字面一致）

## 视觉风格总纲
一段话说明色彩基调、光影风格、镜头运动偏好、整体美学；并给出推荐画面风格标签（如电影级写实、赛博朋克、国风水墨等）。

## 场景视觉辞典
GFM 表，表头不可改：

| 场景名 | 环境 | 时间 | 气氛 | 生图关键词 |
|------|------|------|------|------------|

${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}

## 核心冲突与结构摘要
完整展开：世界观、核心冲突、主要人物、情节起承转合；保留可拆分为分镜的信息量（短题材不少于 400 字）。

## 下一步交接清单
GFM 表：

| 环节 | 说明 | 建议工具/步骤 |
|------|------|---------------|

## 画幅与比例（2.0 补充）
- 推荐画幅比例：（如 16:9 / 9:16 / 2.35:1，并简述理由）
- 画幅说明：（竖屏短视频 / 横屏院线 / 社媒封面等使用场景）

# 约束
- 考虑 AI 生图/生视频可行性：优先单人镜头、可控场景数
- 输出中文；不要 JSON；不要用代码块包裹全文
- 若信息足够，可同时输出 ## 角色视觉辞典 与 ## 分镜脚本（表头与专业版一致），不得留空表`;

export const STORY_PRO2_THEME_OUTLINE_USER_PREFIX =
  "请根据以下故事主题或内容，生成完整故事大纲：";

/** 2.0 脚本生成器 · 大纲段（主题 / 上游文本 / Dock 补充 → 制作包前段） */
export const STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT = `# 任务：故事剧本 · 大纲段（视觉风格 + 场景 + 结构 + 交接）

你将收到故事主题、梗概或上游创意参考。请输出 **Markdown**（不要 JSON、不要代码块）。

${STORY_PRO_PACK_OUTPUT_RULES}

# 本段须输出的 ## 章节
## 视觉风格总纲
## 场景视觉辞典（GFM 表：场景名 | 环境 | 时间 | 气氛 | 生图关键词）
${STORY_PRO2_SCENE_DICT_EMPTY_SHOT_RULES}
## 核心冲突与结构摘要
## 下一步交接清单（GFM 表：环节 | 说明 | 建议工具/步骤）

- **章节标题与表头分行**；禁止标题与表头写在同一行
- 若信息足够，可同时输出 ## 角色视觉辞典 与 ## 分镜脚本（表头与专业版一致），不得留空表

${STORY_PRO2_THEME_OUTLINE_USER_PREFIX}`;

/** 2.0 脚本节点 · 角色段（基于故事大纲，非「上传剧本」） */
export const STORY_PRO2_CHARACTER_PROMPT = `# 任务：角色视觉辞典（AI 生图预备 · 角色一致性基础）

根据 **已连接的故事大纲 / 创意参考包** 与已生成「视觉风格总纲 / 场景辞典」，输出 **## 角色视觉辞典** 段。

【制作包硬性约束 · 缺一不可 · 影响 AI 生图角色一致性】
1. 必须输出 **## 角色视觉辞典** GFM 表，表头列名不可改。
2. 角色须来自故事大纲中已写明的人物，**禁止**擅自替换题材或套用无关示例剧情。
3. 不要 JSON；不要用代码块包裹全文。

# 输出格式（表头列名不可改）
## 角色视觉辞典

| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |
|------|------|----------------------|------|---------------------|

# 字段详解（务必详尽）

## 外貌/服装/标志性动作（AI 角色一致性关键）
- **面部特征**：脸型、五官比例、肤色、发型发色（具体长度/造型）、眼睛颜色
- **体型**：身高（高/中/矮）、体型（瘦/匀称/健壮/微胖）、年龄段外观
- **服装**：完整描述上衣、下装、鞋子、配饰；包含颜色、材质、款式
- **标志性元素**：眼镜、帽子、伤疤、纹身、发饰、常带物品等
- **动作习惯**：习惯性姿势、走路方式、手势等

## AI生图提示词(英文)（每角色必填）
- 格式：可直接用于 AI 生图的英文提示词
- 包含：gender, age, face shape, hair (color/style/length), eyes, skin tone, build, clothing details, accessories, distinctive features
- 示例：young Chinese boy, 10 years old, round face, short black hair, bright eyes, fair skin, chubby build, wearing white tank top and blue shorts, energetic expression

- **必须**输出上表；每行一个主要角色（3~8 行）
- **外貌描写字数不少于 50 字**；泛泛写「普通/一般」无法生成一致角色
- 若大纲中已有角色信息，须 **完整迁移并扩写**，不得删行
- 只输出「## 角色视觉辞典」+ 一张表，不要 JSON`;

/** 2.0 脚本节点 · 场景段（根据大纲场景辞典生成 AI 生图提示词） */
export const STORY_PRO2_SCENE_PROMPT = `# 任务：场景视觉提示词（AI 生图预备）

根据 **已连接的故事大纲** 中的「场景视觉辞典」，为每个场景生成可直接用于 AI 生图的英文提示词。

【制作包硬性约束 · 缺一不可】
1. 必须输出 **## 场景视觉提示词** GFM 表，表头列名不可改。
2. **场景名** 须与大纲「场景视觉辞典 · 场景名」列 **完全一致**，禁止新增、删减或替换场景。
3. 须根据大纲中的环境、时间、气氛、生图关键词扩写 **AI生图提示词(英文)**；每个场景不少于 40 个英文词。
4. 不要 JSON；不要用代码块包裹全文。

# 输出格式（表头列名不可改）
## 场景视觉提示词

| 场景名 | 环境 | 时间 | 气氛 | 场景描述 | AI生图提示词(英文) |
|------|------|------|------|----------|---------------------|

# 字段详解

## 场景描述（纯环境空镜约束）
- 综合环境 / 时间 / 气氛的中文一句话摘要（20～60 字）
- 须与大纲场景辞典信息一致，可适度扩写画面细节
- **【严格约束】本栏只描述纯物理环境和气氛，禁止出现以下内容：**
  - ❌ 禁止出现任何角色名字或代词（如"他"、"她"、"主角"、"人物"）
  - ❌ 禁止描写人物动作（如"走来"、"看向"、"拿起"、"交谈"、"转身"）
  - ❌ 禁止描写面部表情、肢体动作或特写镜头
  - ✅ 只允许描写：空间结构、建筑材质、光线来源与方向、色彩基调、天气气象、表面质感与纹理、环境声音/气味、静态置景与道具
  - 正确示例："废弃工厂内部，挑高穹顶，午后阳光从破裂天窗斜射而入，空气中漂浮金色尘埃，地面布满锈蚀机械零件，整体呈冷灰色调"
  - 错误示例（含人物）："主角走进废弃工厂，皱着眉头环顾四周，阳光照在他脸上"

## AI生图提示词(英文)（每场景必填 · 纯背景空镜约束）
- 格式：可直接用于 AI 文生图的英文提示词
- **【严格约束】生成的提示词必须以场景环境为主体，禁止包含人物、人形、面部、特写镜头：**
  - ❌ 禁止出现与人物相关的词汇：person, people, human, character, figure, face, eye, expression, hand, arm, leg, body, portrait, close-up, walking, standing, sitting, running, looking, wearing
  - ❌ 禁止出现与人物相关的镜头术语：close-up shot, medium shot, focus on face, character POV
  - ✅ 必须使用：establishing shot, wide shot, landscape view, empty scene, devoid of people, no characters
  - ✅ 必须包含：location（地点）, time of day（时间）, lighting（光线）, weather/climate（天气）, atmosphere（气氛）, key props（关键道具）, composition（构图）, cinematic style（电影风格）
  - 正确示例（纯场景）："abandoned factory interior, tall arched ceiling, afternoon sunlight streaming through broken skylight, golden dust particles floating in the air, rusted mechanical parts scattered on concrete floor, cold gray tone, cinematic wide establishing shot, empty scene, no people"
  - 错误示例（含人物）❌："a young man walking through abandoned factory, looking around with worried expression, sunlight hitting his face, wearing a leather jacket"

- 每行对应大纲场景视觉辞典中的一行；行数须一致
- 只输出「## 场景视觉提示词」+ 一张表，不要 JSON`;

/** 2.0 脚本节点 · 分镜段（基于故事大纲，非「上传剧本」） */
export const STORY_PRO2_STORYBOARD_PROMPT = `# 任务：分镜脚本表（AI 生图/生视频预备 · 定稿拆分真源）

根据 **已连接的故事大纲 / 创意参考包**、**场景视觉提示词**、风格总纲与角色辞典，将故事拆解为镜头序列。**须与大纲题材、人物、场景一致**；禁止只输出 3～5 个概括镜头，禁止套用与大纲无关的示例剧情。

【制作包硬性约束 · 缺一不可 · 影响 AI 生图/生视频质量】
1. 必须输出 **## 分镜脚本** GFM 表，表头列名不可改。
2. 分镜 **角色名** 须与「角色视觉辞典 · 姓名」列 **完全一致**。
3. 不要 JSON；不要用代码块包裹全文。

# 输出格式（表头列名不可改）
## 分镜脚本

| 镜号 | 景别 | 运镜 | 画面描述 | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|----------|------|----------|---------------------|---------------------|---------------|

# 字段详解（务必详尽）

## 景别（影响画面构图）
- 远景/全景/中景/中近景/近景/特写/大特写
- 根据叙事需要选择：情绪爆发用特写，场景交代用远景

## 运镜（影响视频动态感）
- 固定/推/拉/摇/移/跟/升/降/环绕/手持晃动
- 每镜须明确运镜方式，禁止全部写「固定」

## 画面描述（AI 生图/视频的视觉指导）
- **角色**：姓名（须与角色辞典一致）、表情、姿势、动作
- **场景**：环境名（须与场景辞典一致）、光线、天气、氛围
- **构图**：主体位置、前景/背景元素、画面层次
- 字数 **不少于 30 字**

## AI生图提示词(英文)（每镜必填 · 用于分镜图生成）
- 格式：可直接用于 AI 生图的英文提示词
- 包含：角色外貌特征（复用角色辞典）、表情、姿势、服装、场景环境、光线、构图、风格
- 示例：young Chinese boy with round face and short black hair, wearing white tank top and blue shorts, excited expression, standing in front of watermelon stall, afternoon sunlight, school gate background, cinematic composition, warm summer atmosphere

## AI视频提示词(英文)（每镜必填 · 用于分镜视频生成）
- 格式：可直接用于 AI 视频生成的英文提示词
- 包含：主体、动作、环境、镜头运动、氛围、风格
- **必须包含动态描述**：角色动作、镜头移动、环境变化
- 示例：young Chinese boy running excitedly towards watermelon stall, camera following from behind, afternoon golden sunlight, busy school gate with students walking, cinematic slow motion, warm summer vibes

- 镜号从 1 **连续递增**；时长为整数秒；短片不少于 **8** 镜
- **对白**列：格式「角色名：台词」；无对白写「—」
- **画面描述**写镜头视觉，不要把台词堆在这一列
- 有对白时在 **口型/配音备注** 标注口型同步或后期配音
- 只输出「## 分镜脚本」+ 一张表，不要 JSON`;

export function storyPro2HubDefaultPromptPack(): {
  promptOutline: string;
  promptCharacter: string;
  promptScene: string;
  promptStoryboard: string;
} {
  return {
    promptOutline: STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
    promptCharacter: STORY_PRO2_CHARACTER_PROMPT,
    promptScene: STORY_PRO2_SCENE_PROMPT,
    promptStoryboard: STORY_PRO2_STORYBOARD_PROMPT,
  };
}
