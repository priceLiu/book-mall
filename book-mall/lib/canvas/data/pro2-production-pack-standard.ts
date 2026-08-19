/**
 * Pro2 制作包 v8 · 默认/古风 hub 共用标准（canvas-web 真源）
 * book-mall/lib/canvas/data/pro2-production-pack-standard.ts 须保持同步
 * 权威提示词：docs/大模型剧本提示词.md · 金标准范例：docs/画布提示词.md
 */

/** pack v8 指纹 · migrate 与 legacy 检测 */
export const STORY_PRO2_PACK_V8_MARKER = "道具六视图生成";

/** @deprecated v7 指纹 · 旧画布 migrate 检测 */
export const STORY_PRO2_PACK_V7_MARKER = "序号 | 交接项 | 负责方 | 备注";

/** @deprecated v6 指纹 · 旧画布 migrate 检测 */
export const STORY_PRO2_PACK_V6_MARKER = "核心冲突 GFM 表";

/** 场景视觉辞典 4 列表头（字面一致 · 解析器依赖） */
export const STORY_PRO2_SCENE_TABLE_HEADER = `| 场景名 | 环境/时间/气氛 | 生图关键词(英文) | 固定反向提示词 |
|------|----------------|---------------------|------------------|`;

/** 角色视觉辞典 5 列表头 */
export const STORY_PRO2_CHARACTER_TABLE_HEADER = `| 姓名 | 身份 | 外貌/服装/标志性动作 | 性格 | AI生图提示词(英文) |
|------|------|----------------------|------|---------------------|`;

/** 画布表格 UI 列名（MD 表头仍含「(英文)」供解析；界面展示去掉） */
export const STORY_PRO2_UI_CHARACTER_AI_PROMPT_LABEL = "AI生图提示词";
export const STORY_PRO2_UI_STORYBOARD_AI_IMAGE_LABEL = "AI生图提示词";
export const STORY_PRO2_UI_STORYBOARD_AI_VIDEO_LABEL = "AI视频提示词";
export const STORY_PRO2_UI_SCENE_IMAGE_KEYWORDS_LABEL = "生图关键词";

/** @deprecated v1 · 9 列含 AI 生图/视频 · legacy migrate 检测用 */
export const STORY_PRO2_STORYBOARD_TABLE_HEADER_V1 = `| 镜号 | 景别 | 运镜 | 画面描述（含起始→终止站位） | 对白 | 时长(秒) | AI生图提示词(英文) | AI视频提示词(英文) | 口型/配音备注 |
|------|------|------|---------------------------|------|----------|---------------------|---------------------|---------------|`;

/** v2 Pass1 · 10 列导演表（无 AI 列 · 字面一致 · 解析器依赖） */
export const STORY_PRO2_STORYBOARD_TABLE_HEADER = `| 镜号 | 景别 | 光影 | 运镜 | 画面描述（含起始→终止站位） | 道具 | 对白 | 时长(秒) | 音效 | 口型/配音备注 |
|------|------|------|------|---------------------------|------|------|----------|------|---------------|`;

/** 道具视觉辞典 4 列表头（v2 Pass1 · JSON props[] 对应） */
export const STORY_PRO2_PROP_TABLE_HEADER = `| 道具名 | 描述 | 特征 | 道具生图提示词 |
|------|------|------|----------------|`;

/** 下一步交接清单 4 列表头 */
export const STORY_PRO2_HANDOFF_TABLE_HEADER = `| 序号 | 交接项 | 负责方 | 备注 |
|------|--------|--------|------|`;

/** 交接清单 few-shot（结构参考 · 禁止照抄剧名） */
export const PRO2_HANDOFF_EXAMPLE_ROWS = `${STORY_PRO2_HANDOFF_TABLE_HEADER}
| 1 | 角色三视图生成 | 后期/美术 | 按【角色视觉辞典】AI生图提示词生成主要角色四视图，纯白背景，2K分辨率，确保五官、服装与锚点完全一致 |
| 2 | 场景图生成 | 后期/美术 | 按【场景视觉辞典】逐场景生成 2×2 网格四视角场景设定图 |
| 3 | 道具六视图生成 | 后期/美术 | 按【道具视觉辞典】逐道具生成 2×3 网格六视角产品级道具图 |
| 4 | 分镜提示词润色 | 导演/AI | 在 Hub「生成分镜」弹层 Pass2 生成 frameImagePrompt + videoPrompt，再创建分镜组 |
| 5 | 分镜视频生成 | 后期/AI | 按 Pass2 videoPrompt 逐镜生成 Seedance 视频 |
| 6 | 对白配音 | 后期/音频 | 按口型/配音备注列录制同期声与 OS |`;

/** 全 pack · 输出语言（表头含「(英文)」为解析兼容，列内默认中文） */
export const STORY_PRO2_PACK_LANGUAGE_RULES = `# 输出语言（硬性 · 全制作包适用 · 违反视为失败）

- **默认全部使用中文**：章节说明、表格单元格、对白、画面描述、生图/生视频提示词、固定反向提示词、备注等均写 **中文**
- **表头列名不变**：含 \`(英文)\` 的列名仅为系统解析兼容，**不代表列内须写英文**；禁止因列名含「英文」而输出英文段落
- **非必要禁止英文**：仅允许 \`<<<scene_A>>>\` / \`<<<image_1>>>\` 占位符、HEX 色值（如 \`#D4A050\`）、技术缩写（如 \`35mm\`、\`2K\`、\`-18dB\`）；**禁止**整段英文 portrait / Cinematic prompt / \`[Negative: …]\` 英文标签
- **固定反向提示词 / negativePrompt**：须写 **中文** 顿号或逗号分隔（如 \`动画风、游戏CG、插画风、水印、模糊\`）；**禁止** \`[Negative: blurry, anime]\` 等英文写法
- **AI生图提示词(英文) 列**：列内写 **中文** 电影级生图简报（含完整角色四视图构图规范 + [视觉风格：…]）
- **生图关键词(英文) 列**：列内写 **中文** 环境关键词与 **2×2 网格四视角**场景构图规范 + [视觉风格：…]
- **道具生图提示词 列**：列内写 **中文** **2×3 网格六视图**道具构图规范 + [视觉风格：…]
- **角色表 AI 生图列**：写 **中文** 外貌与服装导演简报（四视图规范），禁止默认输出 gender/age/cinematic 等英文堆砌
- **视觉风格总纲 · 英文风格锚定**：优先写 **中文风格锚定**；非必要不填英文
- **画面风格统一**：所有角色/场景/道具生图提示词末尾须追加 \`[视觉风格：xxx]\`，与总纲一致`;

/** 分镜表「运镜」列撰写规范 · docs/大模型剧本提示词.md §五 */
export const STORY_PRO2_CAMERA_MOVE_COLUMN_RULES = `- 每镜运镜描述 **≥12 字**；禁止只写「固定」「推」等单/双字
- 须同时包含：**机位状态**（固定/手持/摇移/跟拍）+ **运动方向**（推/拉/摇/移/升/降）+ **速度**（缓慢/快速）+ **视觉目的**（强调情绪/揭示信息/衔接动作等）`;

/** 分镜表「对白」列撰写规范 · docs/大模型剧本提示词.md §五 */
export const STORY_PRO2_DIALOGUE_COLUMN_RULES = `- 格式：**角色名（情绪/语气）："台词"**
- 内心独白：**角色名（内心OS，情绪）："台词"**
- 多人对白：**角色群（齐声/低语/议论）："台词语"**
- 无对白写「—」；**禁止**只写台词而不标注说话角色；**禁止**只写在「画面描述」里`;

/** 系统解析契约 · 追加在用户创意模板之后 */
export const STORY_PRO2_PACK_PARSE_CONTRACT = `【系统解析契约 · 硬性 · 影响画布自动拆分】
1. 全部章节须用 \`## 标题\`；禁止 Tab 分隔表；**仅 GFM 管道表**（每行以 | 开头和结尾）。
2. 表头须与下列 **逐字一致**（含括号与标点）：
   - 场景：${STORY_PRO2_SCENE_TABLE_HEADER.split("\n")[0]?.trim()}
   - 角色：${STORY_PRO2_CHARACTER_TABLE_HEADER.split("\n")[0]?.trim()}
   - 道具：${STORY_PRO2_PROP_TABLE_HEADER.split("\n")[0]?.trim()}
   - 分镜：${STORY_PRO2_STORYBOARD_TABLE_HEADER.split("\n")[0]?.trim()}
   - 交接：${STORY_PRO2_HANDOFF_TABLE_HEADER.split("\n")[0]?.trim()}
3. **每行/每镜所有列均须非空**（无对白写「—」；场景反向词可写「（同上）」引用全局反向词）。
4. 单元格内换行用 \`<br>\`，**禁止**物理换行拆行（每镜一行 GFM）。
5. 「画面描述」须含起始→终止站位（可用【起始】…【结束】或 起始/动作/终止）。
6. 「视觉风格总纲」须含可执行色调 HEX、年代/环境、摄影风格；后续生图/视频须与此一致。
7. 「下一步交接清单」至少 6 行，覆盖三视图、场景图、分镜视频、配音、音效/BGM、剪辑交付等。
8. **输出语言**：表头含 \`(英文)\` 仅为解析兼容；列内正文 **默认全部中文**，非必要禁止英文（占位符/HEX/技术缩写除外）；反向词须中文。
9. **机器可读 JSON**：回复 **末尾** 须附唯一 \`\`\`pro2-production-script\` 围栏 JSON（见 JSON 输出契约）；GFM 章节须与 JSON 一致。`;

/** Pro2 · JSON 围栏输出契约（机器可读真源 · 2026-08） */
export const STORY_PRO2_JSON_FIELD_RULES = `【JSON patch 字段名 · 硬性 · 禁止 alias】
- meta.title / meta.synopsis（禁止 patch.title、禁止 synopsis 摊平在 patch 顶层）
- visualStyle：worldBackground · era · globalColorTone · pictureStyle · cinematography · dayPalette · nightPalette · skinMaterial · setDesign · lighting · styleAnchor
  - dayPalette / nightPalette 须为对象 { primary?, highlight?, shadow? }，禁止字符串
  - 禁止 photographyStyle / architectureStyle / colorBlock（colorBlock 仅用于 scenes[] / shots[]）
- coreConflict[]：{ dimension, content }
- scenes[]：{ id, name, environmentTimeMood, imagePrompt, negativePrompt?, colorBlock?, description?, foreground?, atmosphere?, compositionSpec?, visualStyleTag? }
  - 禁止 environment / keywords / prompt 等 alias
- characters[]：{ id, name, role, appearance, personality?, imagePrompt, description?, clothing?, traits?, compositionSpec?, visualStyleTag? }
  - 禁止 identity / aiImagePrompt 等 alias
- props[]（v2 Pass1 必填 · 与分镜道具列对应）：{ id, name, description?, traits?, compositionSpec?, visualStyleTag?, imagePrompt? }
- shots[] v2 Pass1（storyboard step · schemaVersion 2）：
  { index, shotSize, lighting, cameraMove, sceneDescription, propIds?, dialogue, durationSec, sfxNote, audioNote, sceneId?, characterIds? }
  - **禁止** Pass1 写 imagePrompt / videoPrompt / frameImagePrompt（Pass2 shot_prompts 才写）
  - cameraMove 须 ≥12 字中文运镜描述；须含机位状态+运动方向+速度+视觉目的；禁止单/双字如「固定」「推」
  - 禁止 description / aiImagePrompt / duration 等 alias
- shots[] v1 legacy：{ index, shotSize, cameraMove, sceneDescription, dialogue, durationSec, imagePrompt, videoPrompt, audioNote, sceneId?, characterIds? }
- handoff[]：{ index, item, owner, note } 对象数组，禁止字符串数组`;

export const STORY_PRO2_JSON_SCHEMA_EXAMPLE = `{
  "schemaVersion": 2,
  "tier": "pro",
  "step": "storyboard",
  "patch": {
    "meta": { "title": "剧名", "synopsis": "一句话梗概" },
    "props": [
      {
        "id": "prop-computer",
        "name": "电脑",
        "description": "现代办公电脑显示器，窄边框黑色磨砂材质",
        "traits": "现代标准尺寸办公屏幕"
      }
    ],
    "shots": [
      {
        "index": 1,
        "shotSize": "特写",
        "lighting": "深夜室内，极低饱和度的冷蓝光影，压抑沉闷的社畜氛围",
        "cameraMove": "固定机位，微小手持晃动增加压抑感",
        "sceneDescription": "【起始】在伏案加班，双手飞速敲击着，屏幕刺眼的蓝光照在她苍白的脸上。【结束】保持伏案姿势，视线锁定屏幕",
        "propIds": ["prop-computer"],
        "dialogue": "—",
        "durationSec": 5,
        "sfxNote": "急促而沉重的键盘敲击声，微弱的空调底噪",
        "audioNote": "—",
        "sceneId": "scene-office",
        "characterIds": ["char-heroine"]
      }
    ]
  }
}`;

export const STORY_PRO2_JSON_OUTPUT_CONTRACT = `【JSON 结构化输出契约 · 硬性 · 机器可读真源】
1. 回复 **末尾** 须输出 **唯一** 围栏块（语言标记必须为 pro2-production-script）：
\`\`\`pro2-production-script
${STORY_PRO2_JSON_SCHEMA_EXAMPLE}
\`\`\`
2. **step** 取值：full_pack · outline · character · scene · storyboard（与当前任务段一致）；**tier 须为 pro**（禁止 pro2 等别名）。
3. **patch** 内块须与上方 GFM 章节 **字段一致**；缺块或字段名错误视为失败。
4. full_pack 须含非空：visualStyle · coreConflict · scenes · characters · **props[]**（≥1 项）· shots · handoff（至少 6 行）。
5. v2 Pass1（storyboard / full_pack · schemaVersion 2）须 **12–18 镜**，各镜 \`durationSec\` 之和 **175–185 秒**（目标 3 分钟），每镜 **10–15 秒**整数。
   shots[] 每镜必填：shotSize · lighting · cameraMove(≥12字) · sceneDescription · durationSec · sfxNote · audioNote；**禁止** imagePrompt / videoPrompt / frameImagePrompt。
   v1 legacy shots[] 仍须 imagePrompt · videoPrompt。
   Pass2（step=shot_prompts）每镜必填 frameImagePrompt · videoPrompt。
${STORY_PRO2_JSON_FIELD_RULES}
6. 可在围栏前保留人读 Markdown 六章节；**画布以 JSON 为准** 写入 Hub；无有效围栏时任务失败，不回退 GFM。
7. JSON 须为标准 JSON（禁止尾逗号、禁止 // 注释）；仅围栏内允许 JSON。`;

/** 摄影级视觉风格总纲 GFM 维度 */
export const STORY_PRO2_VISUAL_STYLE_TABLE_RULES_V6 = `- **视觉风格总纲**须用 GFM 表输出（表头 \`维度 | 内容\`），须 **具体可执行**：

| 维度 | 内容 |
|------|------|
| 故事背景 | （世界观 / 时代背景 / 戏剧空间，1–3 句） |
| 年代/环境定位 | （时代 + 地点 + 季节/气候） |
| 全剧色调基调 | （主色名 + HEX，日/夜或冷暖对比概述） |
| 画面风格 | 国风二次元厚涂，2D动漫媒介（须与角色/场景/道具视觉风格保持一致） |
| 摄影风格 | （镜头焦段、景深、光比、构图习惯） |
| 日景调色板 | （主色 HEX + 高光/阴影色，若剧本无日景写「—」） |
| 夜景调色板 | （主色 HEX + 辅光色，若剧本无夜景写「—」） |
| 皮肤/材质基调 | （主要角色肤色或材质倾向，可选 HEX） |
| 建筑风格/置景 | （建筑/环境材质与主色，1–2 句） |
| 光影基调 | （自然光方向、轮廓光、拒绝平光等） |
| 英文风格锚定 | （中文风格锚定优先；非必要不写英文，可 prepend 到生图 prompt） |

- 禁止空泛「高质量」「精美」；后续三视图/场景/道具/分镜节点将自动读取此表。
- **画面风格统一**：所有角色、场景、道具的生图提示词末尾须追加 \`[视觉风格：xxx]\`，与总纲一致。`;

/** 核心冲突与结构摘要 · GFM 表规范 */
export const STORY_PRO2_CORE_CONFLICT_TABLE_RULES = `- **核心冲突与结构摘要**须用 GFM 表（表头 \`维度 | 内容\` 或 \`项目 | 内容\`），至少包含：

| 维度 | 内容 |
|------|------|
| 表层/深层冲突 | （外部冲突 + 内心诉求） |
| 人设反差 | （主要角色表面 vs 私下，若有） |
| 人设暴露场景 | （具体到镜号或场次） |
| 悬念/反转钩子 | （开头设疑 + 结尾揭示方向） |
| 节拍/糖点或高潮 | （按镜号或段落标注关键节拍） |
| 情绪曲线 | （起→承→转→合，箭头串联） |

- 禁止仅用散文段落代替 GFM 表；信息量须足以支撑 **12–18 镜**分镜拆分。`;

/** 下一步交接清单 GFM 表规范 */
export const STORY_PRO2_HANDOFF_TABLE_RULES = `- **下一步交接清单**须用 GFM 表（表头 \`序号 | 交接项 | 负责方 | 备注\`），至少 6 行，覆盖：角色三视图、场景图、**道具六视图**、分镜 Pass2 提示词、分镜视频、对白配音、BGM/音效、剪辑交付等；备注须写可执行细节。`;

/** 场景生图关键词(英文) 列 · 金标准撰写规范 */
export const PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES = `# 场景 · 生图关键词(英文) 列撰写规范（金标准）

列内写 **中文**，结构：
（场景名称），（室内/室外），（宏观/微观），高度约X米，宽度约X米。
前背景：（前景层描述）
氛围：（威严压抑/温馨浪漫/紧张悬疑等）
构图规范：高质量专业场景设定图，横向构图，以 2 行 2 列的干净网格四等分整齐排版，每个格子都是独立的 16:9 横向画面，展示同一场景的四个大全景视角：
- 格子1：正面中心线大全景视图…
- 格子2：左前方45度大全景视图…
- 格子3：右前方45度大全景视图…
- 格子4：最深处向外拍摄的正中心全景图
四个视角必须表现同一地点、同一时间、同一天气、同一光源、同一空间结构和同一美术风格。
**禁止项**：不得出现任何人物；不得让四个视角表现成四个不同场景；禁止模糊、低画质、文字水印。
末尾追加 \`[视觉风格：xxx]\``;

/** 角色 AI生图提示词(英文) 列 · 金标准撰写规范 */
export const PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES = `# 角色 · AI生图提示词(英文) 列撰写规范（金标准）

列内写 **中文**，结构：
名称：（角色全名），（身份/定位）
描述：（性别），（年龄），（身高），（体型），（发型/发质/发色），（脸型），（瞳色），（肤色）
服装：（上衣、下装、鞋袜、帽子、配饰等，逐项列出）
特征：（独特面部或身体特征）
构图规范：高质量专业角色设定图，横向构图，纯白色纯净背景，中性摄影棚灯光；布局结构（必须是角色四视图）：
- 图片水平 1/3：正面面部头部特写
- 图片水平剩余 2/3：[全身正面 + 全身左侧 + 全身背面] 并列排列
- 四个视图中间用淡灰色(#E2E2E2)的2px细线分割
**禁止项**：不得出现道具/武器/手持物；不得出现环境背景（仅白色）；不得出现其他角色；不得出现文字水印。
末尾追加 \`[视觉风格：xxx]\``;

/** 道具生图提示词 列 · 金标准撰写规范 */
export const PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES = `# 道具 · 道具生图提示词 列撰写规范（金标准）

列内写 **中文**，结构：
名称：（道具名），（分类/用途）
描述：（材质、颜色、尺寸、结构细节，逐项列出）
特征：（关键识别特征，1-2句）
构图规范：高质量写实道具多角度展示图，横向构图，以 2 行 3 列的干净网格整齐排版，展示道具的六个极正视角（正前/正后/左/右/正上/正下）。纯白色纯净背景，专业产品影棚摄影。
**禁止项**：不得出现任何人物、场景、建筑；必须无文字、无水印。
末尾追加 \`[视觉风格：xxx]\``;

/** Pass2 · 分镜视频 videoPrompt 撰写规范（shot_prompts · 非 Pass1 GFM 列） */
export const STORY_PRO2_VIDEO_PROMPT_RULES = `# Pass2 · 分镜视频 videoPrompt 撰写规范（shot_prompts · 非 Pass1 GFM 列）

- **Pass2 JSON 字段 videoPrompt**；正文写 **中文 Seedance 2.0 多段模板**（台词语言依剧本，默认中文）
- **结构（必须包含以下章节）**：
  出场角色：（角色全名），（性别），（身高）
  ---
  背景场景：（场景名），（时间/光影氛围），（高度/尺寸）+ 道具列表
  ---
  参考图使用规则：（角色/场景/道具参考图规则 · 与金标准一致）
  ---
  前一个分镜描述：（第1镜写「当前分镜为故事开篇。」；第2镜起写上一镜末尾摘要）
  ---
  当前分镜的分段描述：（0-X秒 / X-Y秒 … 每段含：画面、禁止、约束、站位与朝向、运镜、音效、简述）
  ---
  输出约束：（角色/服装/道具/光影/动作/环境一致性 1-6 条）
  [视觉风格：xxx]
- **Seedance 标记**：对话 \`{台词}\` · 音效 \`<描述>\` · BGM 写音量（如 \`音量-18dB\`）· 无字幕写 \`无字幕\`
- **每镜末尾**追加中文反向词：\`【反向】动画风、游戏CG、插画风、动漫风、平光、塑料质感皮肤、水印\`
- **禁止**改编 Pass1 导演事实；禁止英文提示词或 \`[Negative: …]\` 英文反向`;

export const PRO2_UNIVERSAL_NEGATIVE =
  "动画风、游戏CG、插画风、二次元、动漫风、水彩风、油画风、过度后期、塑料质感皮肤、平光、高饱和撞色、现代元素、不自然肤质、僵硬面部、无肤质细节、杂乱构图、水印、签名、文字叠加、模糊、低清晰度";

/** 制作包 Markdown 骨架（## 标题与表头字面一致 · ${STORY_PRO2_PACK_V8_MARKER}） */
export const STORY_PRO2_PACK_MARKDOWN_STRUCTURE = `# 输出骨架（## 标题字面一致 · GFM 表头不可改）

## 视觉风格总纲

| 维度 | 内容 |
|------|------|
| 故事背景 | （世界观 / 时代背景 / 戏剧空间） |
| 年代/环境定位 | （时代 + 地点 + 季节/气候） |
| 全剧色调基调 | （主色 + HEX） |
| 画面风格 | 国风二次元厚涂，2D动漫媒介 |
| 摄影风格 | （焦段、景深、光比） |
| 日景调色板 | （主色/高光/阴影 HEX，无日景写「—」） |
| 夜景调色板 | （主色/辅光 HEX，无夜景写「—」） |
| 皮肤/材质基调 | （可选 HEX） |
| 建筑风格/置景 | （1–2 句） |
| 光影基调 | （自然光、轮廓光、拒绝平光） |
| 英文风格锚定 | （中文风格锚定优先；非必要不写英文） |

## 场景视觉辞典

${STORY_PRO2_SCENE_TABLE_HEADER}

## 核心冲突与结构摘要

| 维度 | 内容 |
|------|------|

## 角色视觉辞典

${STORY_PRO2_CHARACTER_TABLE_HEADER}

## 道具视觉辞典

${STORY_PRO2_PROP_TABLE_HEADER}

## 分镜脚本

${STORY_PRO2_STORYBOARD_TABLE_HEADER}

## 下一步交接清单

${STORY_PRO2_HANDOFF_TABLE_HEADER.split("\n")[0] ?? ""}
${STORY_PRO2_HANDOFF_TABLE_HEADER.split("\n")[1] ?? ""}`;

/** 制作包硬性约束（导演模板 / hub 各段共用 · docs/大模型剧本提示词.md §三/§七） */
export const STORY_PRO2_PACK_OUTPUT_RULES = `【制作包硬性约束 · 缺一不可 · 影响定稿拆分 · ${STORY_PRO2_PACK_V8_MARKER}】
1. 必须输出全部 **## 章节**（含 **道具视觉辞典**）；禁止用「一、二、三」或纯散文代替；**禁止 Tab 分隔表**，仅 GFM 管道表。
2. 所有 GFM 表头列名与骨架 **逐字一致**（含括号与标点）。
3. 「核心冲突与结构摘要」须为 **GFM 表**，禁止纯散文代替。
4. 须 **完整保留** 上传剧本中已有场景、人物与对白，只做结构化整理，不得压缩成梗概。
5. 「分镜脚本」须 **12–18 镜**（目标总时长 3 分钟 · 175–185 秒）；**禁止**只输出 3～5 个概括镜头。
6. **分镜 Pass1 · 每镜 10 列均须非空**（镜号、景别、光影、运镜、画面描述、道具、对白、时长(秒)、音效、口型/配音）；无对白/无道具写「—」；每镜时长 **10–15 秒**整数。
7. **Pass1 禁止** 分镜表含 AI生图/AI视频 列；JSON shots[] **禁止** imagePrompt / videoPrompt / frameImagePrompt（Pass2「生成提示词」才写）。
8. **props[]** 道具辞典 **≥1 项**；GFM **道具视觉辞典** 每行含完整六视图构图规范；分镜「道具」列写名称，JSON 用 propIds 引用。
9. 场景表 **生图关键词(英文)** 列须含 **2×2 四视角**构图规范；角色表 **AI生图提示词(英文)** 列须含 **四视图**构图规范；均末尾追加 \`[视觉风格：…]\`。
10. 「对白」列撰写规范：
${STORY_PRO2_DIALOGUE_COLUMN_RULES}
11. 分镜 **角色名** 须与「角色视觉辞典 · 姓名」列 **完全一致**。
12. 「运镜」列撰写规范：
${STORY_PRO2_CAMERA_MOVE_COLUMN_RULES}
13. 「画面描述」每镜须标注 **【起始】…【结束】**（≥30 字）；「光影」≥8 字。
14. 「下一步交接清单」至少 6 行（含道具六视图、Pass2 提示词、分镜视频等）。
15. 回复 **末尾** 须附 \`\`\`pro2-production-script\` JSON 围栏（schemaVersion 2）；GFM 须与 JSON 一致。
16. ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}`;

/** Pass1 导演表字段金标准 · 源：docs/画布提示词.md · docs/大模型剧本提示词.md §五 */
export const PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE = `# Pass1 导演表字段（v2 · 每镜必填 · ${STORY_PRO2_PACK_V8_MARKER}）

## 运镜
固定机位，微小手持晃动增加压抑感（须 ≥12 字；禁止单/双字；须含机位状态+运动方向+速度+视觉目的）

${STORY_PRO2_CAMERA_MOVE_COLUMN_RULES}

## 光影
深夜室内，极低饱和度的冷蓝光影，压抑沉闷的社畜氛围（须 ≥8 字）

## 画面描述（→ sceneDescription）
【起始】在伏案加班，双手飞速敲击着，屏幕刺眼的蓝光照在她苍白的脸上。【结束】保持伏案姿势，视线锁定屏幕（须含【起始】…【结束】，≥30 字）

## 音效（→ sfxNote）
急促而沉重的键盘敲击声，微弱的空调底噪

## 道具（→ 道具列写名称 · JSON propIds）
电脑（须在 props[] / 道具视觉辞典 中定义）

## 对白
沈昭昭（内心OS，疲惫）："又……加班……"（无对白写「—」）

${STORY_PRO2_DIALOGUE_COLUMN_RULES}

## 口型/配音备注
BGM 音量 dB、口型同步、OS/后期配音说明

## 镜数与时长（硬性）
- 须输出 **12–18 镜**完整序列
- 各镜 \`时长(秒)\` 之和 **175–185 秒**（目标 3 分钟）
- 每镜 **10–15 秒**整数`;

/** Pass2 分镜图金标准 · 源：docs/画布提示词.md §分镜图 */
export const PRO2_PASS2_FRAME_IMAGE_GOLDEN = `特写景别。深夜昏暗的现代办公室场景。画面中心是面色苍白的现代沈昭昭，她是一位偏瘦的现代职场女性，留着干枯的中长黑发，长着瓜子脸，双眼下有明显的黑眼圈，身穿宽松的浅灰色条纹衬衫。她正坐在桌前伏案加班，表情充满社畜的压抑与沉闷感。她的面前摆放着一台窄边框的现代办公电脑，双手正放置在黑色磨砂键盘上飞速敲击。屏幕发出刺眼的冷蓝色光芒，强烈的光源直射在她的脸上，形成极低饱和度的冷蓝光影，背景处于黑暗中。镜头微微前倾，视角平视略带仰视。充满深夜加班的压抑社畜氛围。使用大光圈镜头，背景深度虚化。[视觉风格：穿越题材，国风二次元厚涂，2D动漫媒介，现代场景冷蓝低饱和与场景暖金红高饱和强烈对比，宏大史诗感戏剧性光影与丁达尔效应，厚涂笔触细节与高清电影级动漫质感。]`;

/** Pass2 分镜视频金标准 · 源：docs/画布提示词.md §分镜视频（占位符已补全） */
export const PRO2_PASS2_VIDEO_GOLDEN = `出场角色：
现代沈昭昭，28岁女性，身高1.65米

---

背景场景：
现代办公室，深夜冷蓝光影，高度约3米
电脑显示器，桌面放置，高度45厘米
键盘，桌面放置，厚度3厘米

---

参考图使用规则：
角色参考图：只参考此图中的角色形象；不参考角度、构图、姿势、表情；若此参考图是角色多视图，则必须确保角色不能重复出现（除非明确要求角色分身）。
场景参考图：只参考此图中的场景位置、大小、形状、结构关系；不参考角度、构图、多角色站位；氛围、色调、光影、元素风格等根据剧情内容来酌情参考。
道具参考图：只参考此图中的道具大小、形状、结构；不参考角度、构图、位置。

---

前一个分镜描述：
当前分镜为故事开篇。

---

当前分镜的分段描述：
0-3 秒：
画面：特写景别，深夜现代办公室内，现代沈昭昭坐于桌前。身穿浅灰条纹衬衫，苍白脸庞与黑眼圈在屏幕刺眼的冷蓝光下极为清晰。双手放上键盘，手指飞速敲击。
禁止：禁止出现白天光线，禁止人物露笑容，禁止屏幕无光。
约束：保持冷蓝光影，人物视线聚于屏幕，敲击动作符合自然。
站位与朝向：正对电脑，面部朝向画面前方。
运镜：固定机位，微小手持晃动。
音效：急促沉重的敲击声。
简述：满脸疲惫地飞速敲击。

3-5 秒：
画面：特写景别，动作不停，双手继续敲击。随着动作持续，面部微抽，眼神麻木，屏幕蓝光在脸上明暗闪烁。
禁止：禁止人物停手，禁止环境变亮，禁止跳变。
约束：人物表情极度压抑，蓝光反射自然贴合面部。
站位与朝向：保持坐姿，上身微倾。
运镜：固定机位，持续晃动，缓慢推进。
音效：持续敲击声。
简述：机械打字，压抑感加深。

---

输出约束：
1. 角色一致性：保持苍白面容特征。
2. 服装一致性：条纹衬衫纹理清晰可见。
3. 道具一致性：电脑与键盘符合现代款式。
4. 光影一致性：光源仅来自屏幕冷蓝光。
5. 动作连续性：双手敲击动作流畅。
6. 环境一致性：现代办公室背景始终虚化。

[视觉风格：穿越题材，国风二次元厚涂，2D动漫媒介，现代场景冷蓝低饱和与场景暖金红高饱和强烈对比，宏大史诗感戏剧性光影与丁达尔效应，厚涂笔触细节与高清电影级动漫质感。]`;

/** few-shot 免责声明（默认/古风 pack 共用） */
export const PRO2_SHOT_GFM_EXAMPLE_DISCLAIMER = `# GFM 分镜映射样例（结构参考 · 禁止照抄示例剧名/角色/场景名）

以下展示 **v2 Pass1 十列导演表**完整粒度（无 AI 生图/视频列）；生成时须 **依用户大纲题材改写** 人物、场景与剧情，仅复用结构与写法。`;

/** 镜 1 / 4 / 5 / 8 完整行 · v2 Pass1 导演表 */
export const PRO2_DEFAULT_SHOT_GFM_EXAMPLE = `${PRO2_SHOT_GFM_EXAMPLE_DISCLAIMER}

${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 大全景→中景 | 正午暖金侧逆光，明暗对比强烈 | 缓慢摇移推进，前景旗幡遮挡增加层次 | 【起始】长安城朱雀大街南端，镜头向北缓慢摇移推进，两侧酒楼商铺红灯笼布幡招展，百姓人头攒动。沈知意背对镜头站立，双手紧握一卷明黄婚书，指尖因用力而泛白。百姓仰头望向她，交头接耳议论纷纷。【结束】沈知意保持高举婚书姿势，身体微僵，目光锁定楼下。 | 明黄婚书 | 百姓甲："听说了吗？沈家小姐今天要当众退摄政王的婚！"百姓乙："那可是摄政王啊！她疯了吧？" | 10 | 人群议论声、旗幡猎猎 | 百姓群杂同步收音 |
| 4 | 全景→慢动作特写 | 月光冷白与灯笼暖黄交织蓝金色调 | 全景转慢动作推进，坠落瞬间慢速强调 | 【起始】沈知意鬼鬼祟祟爬上青砖墙头，鹅黄色裙摆被老槐树枝桠勾住。她用力拉扯裙摆时身体失去平衡向后仰倒，发出一声短促惊叫。切换至慢动作特写：她坠落时惊慌失措的表情定格，花瓣随她一同飘落。萧景珩恰好骑马经过墙下闻声抬头张开双臂，两人碰撞在一起，他稳稳将她接入怀中，冲力使两人一同摔进松软草地。【结束】萧景珩仰躺于草地，沈知意趴在他胸膛上方，双臂撑在他身体两侧，长发散落垂在他脸侧，两人相距不足一掌，面对面凝视。 | — | 沈知意："对……对不起！我不是故意砸你的！" | 12 | 裙摆撕裂声、落入草地闷响 | 女主台词同期声录制 |
| 5 | 近景→特写 | 月光与灯笼浪漫氛围，柔和侧逆光 | 中景推至特写，系鞋带瞬间短暂慢速强调 | 【起始】承接上一镜末尾：萧景珩仰躺于草地，沈知意趴于他胸膛上方，两人相距不足一掌。沈知意慌忙从他身上爬起来后退两步，右脚绣鞋脱落在草丛中，穿着罗袜的脚羞赧蜷缩脚趾。萧景珩不紧不慢站起身拍掉草屑花瓣，低头在草丛中捡起鹅黄色绣鞋，在她惊讶目光下单膝蹲下，一手轻握她纤细脚踝，另一手小心翼翼为她穿好绣鞋，动作轻柔缓慢。沈知意低头看他，脸红透到耳根，嘴唇微张说不出话，手指无意识绞紧袖口。【结束】沈知意鞋已穿好双脚站立于草地，面朝萧景珩；萧景珩已站起身面朝沈知意，两人相距一步。 | 鹅黄绣鞋 | 萧景珩："姑娘，下次翻墙，记得看路。"沈知意内心OS："他……他怎么这么温柔？" | 12 | 古风暧昧轻音乐继续，音量-18dB | 男主台词同期声，OS单独配音轨 |
| 8 | 中景 | 暖金阳光，柔和侧逆光打亮人物轮廓 | 快速剪辑，时长2秒，手持微晃 | 【起始】沈知意在花园小径扑蝴蝶，身体前倾追逐，脚下被石子一绊身体失去平衡向前扑倒。萧景珩从她身后三步外瞬间闪现，长臂一勾揽住她的细腰将她捞回怀中。【结束】两人相拥站立于花园小径中央，萧景珩右臂揽住沈知意腰部，沈知意双手下意识抓住他前襟衣料，面对面相距不足半尺，衣袂翻飞交缠。 | — | — | 3 | 古风暧昧轻音乐继续，音量-15dB | 无人声，仅BGM |`;

/** 分镜段 LLM 专用 · 单镜结构参考（减 token；完整 4 镜见 PRO2_DEFAULT_SHOT_GFM_EXAMPLE） */
export const PRO2_STORYBOARD_FEW_SHOT_COMPACT = `${PRO2_SHOT_GFM_EXAMPLE_DISCLAIMER}

${PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE}

【分镜段任务】须输出 **完整镜头序列**（**12–18 镜** · 总时长 175–185 秒）；**每镜必填 \`时长(秒)\` 整数 10–15**；禁止只输出 1–2 镜样例即停，禁止「镜数规划」小表代替 10 列 GFM 分镜表。
**Pass1 禁止** 输出 AI生图/AI视频 列或 JSON 内 imagePrompt/videoPrompt/frameImagePrompt；分镜图/视频提示词由 Pass2「生成提示词」完成。

**单镜结构参考（仅 1 镜 · 禁止照抄剧情 · 须依大纲续写至目标镜数）**：

${STORY_PRO2_STORYBOARD_TABLE_HEADER}
| 1 | 特写 | 深夜室内，极低饱和度的冷蓝光影，压抑沉闷的社畜氛围 | 固定机位，微小手持晃动增加压抑感 | 【起始】在伏案加班，双手飞速敲击着，屏幕刺眼的蓝光照在她苍白的脸上。【结束】保持伏案姿势，视线锁定屏幕 | 电脑 | — | 5 | 急促而沉重的键盘敲击声，微弱的空调底噪 | — |`;
