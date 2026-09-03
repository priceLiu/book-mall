/**
 * Pro2 制作包 v8 · 默认/古风 hub 共用标准（canvas-web 真源）
 * book-mall/lib/canvas/data/pro2-production-pack-standard.ts 须保持同步
 * 权威提示词：docs/大模型剧本提示词.md · 金标准范例：docs/画布提示词.md
 */

/** pack v8 指纹 · migrate 与 legacy 检测 */
export const STORY_PRO2_PACK_V8_MARKER = "道具六视图生成";

/** JSON-only v13 指纹 · migrate 与 legacy prompt 检测 */
export const STORY_PRO2_JSON_ONLY_MARKER = "json-only-v13";

/** @deprecated v7 指纹 · 旧画布 migrate 检测 */
export const STORY_PRO2_PACK_V7_MARKER = "序号 | 交接项 | 负责方 | 备注";

/** @deprecated v6 指纹 · 旧画布 migrate 检测 */
export const STORY_PRO2_PACK_V6_MARKER = "核心冲突 GFM 表";

/** 场景视觉辞典 4 列表头（字面一致 · 解析器依赖） */
export const STORY_PRO2_SCENE_TABLE_HEADER = `| 场景名 | 环境/时间/气氛 | 生图关键词(英文) | 固定反向提示词 |
|------|----------------|---------------------|------------------|`;

/** 角色视觉辞典 5 列表头 */
export const STORY_PRO2_CHARACTER_TABLE_HEADER = `| 姓名 | 身份 | 外貌/服装/特征 | 性格 | AI生图提示词(英文) |
|------|------|------------------|------|---------------------|`;

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
export const STORY_PRO2_DIALOGUE_COLUMN_RULES = `- **唯一合法格式**：角色名（情绪/语气）："台词"
  - 正例：沈昭昭（疲惫）："又要加班……"
  - 正例（内心OS）：沈昭昭（内心OS，疲惫）："又要加班……"
  - 正例（无情绪括号也可）：沈昭昭："又要加班……"
  - 正例（多句连写）：萧景珩（温和）："姑娘小心。"沈知意（羞赧）："谢公子。"
  - 正例（群杂）：百姓甲（议论）："她要退婚？"
- **引号硬性**：台词必须用 ASCII 直引号 \`"..."\` 或直角引号 \`「...»\` 包住；**禁止**弯引号 “…” / ‘…’ / 『…』
- **禁止**：
  - 无引号：\`沈昭昭（疲惫）：又要加班\`
  - 缺少角色名：\`"又要加班"\`
  - 多加「说/道」：\`沈昭昭说："又要加班"\`
  - 只写叙述或把对白写进 sceneDescription
- 无对白写「—」`;

/** 系统解析契约 · JSON-only v13（程序只解析 pro2-production-script 围栏） */
export const STORY_PRO2_PACK_PARSE_CONTRACT = `【系统解析契约 · JSON-only v13 · 硬性】
1. **只输出** 唯一 \`\`\`pro2-production-script\` JSON 围栏；**禁止** Markdown 章节、GFM 表、说明文字、前言/后记。
2. JSON 须为标准 JSON（禁止尾逗号、禁止 // 注释）；缺围栏或 Zod/语义校验失败 → 任务失败，**无 MD 回退**。
3. 字段名与结构见【JSON patch 字段名】；Pass1 shots[] **禁止** imagePrompt / videoPrompt / frameImagePrompt。
4. 全文默认中文（占位符/HEX/技术缩写除外）；对白格式见对白撰写规范。`;

/** Pro2 · JSON 围栏输出契约（机器可读真源 · 2026-08） */
export const STORY_PRO2_JSON_FIELD_RULES = `【JSON patch 字段名 · 硬性 · 禁止 alias】
- meta.title / meta.synopsis（禁止 patch.title、禁止 synopsis 摊平在 patch 顶层）
- visualStyle：worldBackground · era · globalColorTone · pictureStyle · cinematography · dayPalette · nightPalette · skinMaterial · setDesign · lighting · styleAnchor
  - dayPalette / nightPalette 须为对象 { primary?, highlight?, shadow? }，禁止字符串
  - 禁止 photographyStyle / architectureStyle / colorBlock（colorBlock 仅用于 scenes[] / shots[]）
- coreConflict[]：{ dimension, content }
- scenes[]：{ id, name, environmentTimeMood, imagePrompt, negativePrompt?, colorBlock?, description?, foreground?, atmosphere?, compositionSpec?, visualStyleTag? }
  - **imagePrompt 硬性**：字符串内必须同时含字面量「构图规范」与「[视觉风格：…]」；禁止只写名称/描述；场景用 2×2 四视角构图规范全文
  - colorBlock 须为对象 { primary, secondary?, highlight?, shadow?, notes? }，禁止字符串；无色块则省略
  - 禁止 environment / keywords / prompt 等 alias
- characters[]：{ id, name, role, appearance, personality?, imagePrompt, description?, clothing?, traits?, compositionSpec?, visualStyleTag? }
  - appearance 须为 ①外貌 / ②服装 / ③特征 三段（或分别写 description · clothing · traits）
  - traits 强制 ≥3 项固定面部/体态细节；**禁止** 在 appearance 写「标志性动作」
  - **imagePrompt 硬性**：须含字面量「构图规范」（四视图）与「[视觉风格：…]」
  - 禁止 identity / aiImagePrompt 等 alias
- props[]（v2 Pass1 必填 · 与分镜道具列对应）：{ id, name, description?, traits?, compositionSpec?, visualStyleTag?, imagePrompt? }
  - **imagePrompt 硬性（每条必填）**：须含字面量「构图规范」（六视图）与「[视觉风格：…]」；禁止省略 imagePrompt
- shots[] v2 Pass1（storyboard step · schemaVersion 2）：
  { index, shotSize, lighting, cameraMove, sceneDescription, propIds?, dialogue, durationSec, sfxNote, audioNote, sceneId?, characterIds? }
  - **禁止** Pass1 写 imagePrompt / videoPrompt / frameImagePrompt（Pass2 shot_prompts 才写）
  - cameraMove 须 ≥12 字中文运镜描述；须含机位状态+运动方向+速度+视觉目的；禁止单/双字如「固定」「推」
  - **sceneId 每镜必填**；须引用 scenes[].id；scenes[]≥2 时 **禁止全片同一 sceneId**；每镜 lighting 须与同镜 sceneId 绑定（多场景时 lighting **须含 scenes[].name** canonical name）
  - **dialogue 硬性**：非「—」时须 \`角色名（情绪）："台词"\`；台词须 ASCII \`"..."\` 或 \`「...»\`；禁止无引号、弯引号、\`角色说：\`
  - **characterIds 硬性**：dialogue 非「—」时 characterIds 必须为非空数组，且每项为 characters[].id；禁止有对白却缺/空 characterIds
  - 禁止 description / aiImagePrompt / duration 等 alias
- shots[] v1 legacy：{ index, shotSize, cameraMove, sceneDescription, dialogue, durationSec, imagePrompt, videoPrompt, audioNote, sceneId?, characterIds? }
- handoff[]：{ index, item, owner, note } 对象数组，禁止字符串数组`;

export const STORY_PRO2_JSON_SCHEMA_EXAMPLE = `{
  "schemaVersion": 3,
  "tier": "pro",
  "step": "full_pack",
  "patch": {
    "meta": { "title": "示例剧名", "synopsis": "一句话梗概", "packProfile": "director", "source": "creative" },
    "visualStyle": {
      "worldBackground": "现代都市职场",
      "era": "当代",
      "globalColorTone": "冷蓝低饱和",
      "pictureStyle": "国风二次元厚涂，2D动漫媒介",
      "cinematography": "35mm 浅景深",
      "dayPalette": { "primary": "#3A4A5C", "highlight": "#6A8AAA", "shadow": "#1A2030" },
      "nightPalette": { "primary": "#1A2030", "highlight": "#4A6A8A", "shadow": "#0A1020" },
      "skinMaterial": "苍白偏冷",
      "setDesign": "现代开放式办公室",
      "lighting": "屏幕冷蓝光为主，环境极暗",
      "styleAnchor": "现代场景冷蓝低饱和与场景暖金红高饱和强烈对比"
    },
    "coreConflict": [
      { "dimension": "表层冲突", "content": "加班与身体极限" }
    ],
    "scenes": [
      {
        "id": "scene-office",
        "name": "现代深夜办公室",
        "environmentTimeMood": "深夜，极低饱和冷蓝，压抑",
        "imagePrompt": "名称：现代深夜办公室，深夜开放式办公区。描述：室内，宏观，高度约3米，宽度约15米。前背景：工位隔板、显示器、键盘。氛围：压抑沉闷。构图规范：（2×2四视角场景规范全文）。[视觉风格：…]",
        "negativePrompt": "动画风、游戏CG、插画风、水印"
      },
      {
        "id": "scene-palace",
        "name": "盛唐金銮殿",
        "environmentTimeMood": "盛唐，白日，暖金朱红高饱和，威严",
        "imagePrompt": "名称：盛唐金銮殿。描述：…。构图规范：（2×2四视角场景规范全文）。[视觉风格：…]",
        "negativePrompt": "动画风、游戏CG、插画风、水印"
      }
    ],
    "characters": [
      {
        "id": "char-heroine",
        "name": "现代沈昭昭",
        "role": "现代职场女性",
        "description": "女，28岁，身高1.65米，偏瘦，瓜子脸，中长发干枯黑色，黑瞳，肤色苍白",
        "clothing": "宽松浅灰色条纹衬衫，黑色西装长裤，黑色平底皮鞋，无帽无配饰",
        "traits": "①眼下明显黑眼圈呈青紫色 ②双颊微陷 ③右手食指与中指内侧有薄茧",
        "appearance": "① 外貌：女，28岁…\\n② 服装：…\\n③ 特征：…",
        "personality": "压抑、疲惫",
        "imagePrompt": "名称：现代沈昭昭，现代职场女性\\n描述：…\\n服装：…\\n特征：…\\n构图规范：（四视图规范全文）\\n[视觉风格：…]"
      },
      {
        "id": "char-prince",
        "name": "萧景珩",
        "role": "盛唐皇子",
        "description": "男，26岁，身形挺拔，眉目清朗",
        "clothing": "明黄团龙纹常服，玉冠束发",
        "traits": "①眉骨略高 ②下颌线清晰 ③左颊浅疤",
        "appearance": "① 外貌：男，26岁…\\n② 服装：…\\n③ 特征：…",
        "personality": "温和克制",
        "imagePrompt": "名称：萧景珩，盛唐皇子\\n描述：…\\n服装：…\\n特征：…\\n构图规范：（四视图规范全文）\\n[视觉风格：…]"
      }
    ],
    "props": [
      {
        "id": "prop-computer",
        "name": "电脑",
        "description": "16:9宽屏液晶显示器，窄边框，黑色磨砂材质",
        "traits": "现代标准尺寸办公屏幕",
        "imagePrompt": "名称：电脑，现代办公电脑显示器。描述：…。特征：…。构图规范：（六视图规范全文）。[视觉风格：…]"
      }
    ],
    "shots": [
      {
        "index": 1,
        "shotSize": "特写",
        "lighting": "现代深夜办公室，极低饱和度的冷蓝光影，压抑沉闷的社畜氛围",
        "cameraMove": "固定机位，微小手持晃动增加压抑感",
        "sceneDescription": "【起始】在伏案加班，双手飞速敲击着，屏幕刺眼的蓝光照在她苍白的脸上。【结束】保持伏案姿势，视线锁定屏幕",
        "propIds": ["prop-computer"],
        "dialogue": "沈昭昭（内心OS，疲惫）：\\"又……加班……\\"",
        "durationSec": 12,
        "sfxNote": "急促而沉重的键盘敲击声，微弱的空调底噪",
        "audioNote": "—",
        "sceneId": "scene-office",
        "characterIds": ["char-heroine"]
      },
      {
        "index": 2,
        "shotSize": "全景",
        "lighting": "盛唐金銮殿，白日暖金朱红高饱和，威严恢宏",
        "cameraMove": "缓慢横移，揭示殿内柱廊纵深与金漆细节",
        "sceneDescription": "【起始】空镜扫过金銮殿柱廊。【结束】定格于御座方向",
        "propIds": [],
        "dialogue": "—",
        "durationSec": 12,
        "sfxNote": "远处朝臣低语与甲胄轻响",
        "audioNote": "—",
        "sceneId": "scene-palace",
        "characterIds": []
      },
      {
        "index": 3,
        "shotSize": "中景",
        "lighting": "盛唐金銮殿，白日暖金朱红高饱和，威严恢宏",
        "cameraMove": "固定机位缓慢推近，强调人物与殿内纵深关系",
        "sceneDescription": "【起始】萧景珩自柱廊侧入画停步。【结束】抬手示意殿内安静",
        "propIds": [],
        "dialogue": "萧景珩（温和）：\\"殿内肃静。\\"",
        "durationSec": 12,
        "sfxNote": "衣袂轻响，殿内回声",
        "audioNote": "—",
        "sceneId": "scene-palace",
        "characterIds": ["char-prince"]
      }
    ],
    "handoff": [
      { "index": 1, "item": "角色三视图生成", "owner": "后期/美术", "note": "按角色 imagePrompt 四视图" }
    ]
  }
}`;

export const STORY_PRO2_JSON_OUTPUT_CONTRACT = `【JSON 结构化输出契约 · JSON-only v13 · ${STORY_PRO2_JSON_ONLY_MARKER}】
1. **唯一合法回复**：仅输出一个 \`\`\`pro2-production-script\` 围栏块（语言标记必须为 pro2-production-script），**禁止**围栏外任何文字。
\`\`\`pro2-production-script
${STORY_PRO2_JSON_SCHEMA_EXAMPLE}
\`\`\`
2. **step** 取值：full_pack · outline · character · scene · storyboard · shot_prompts（与当前任务段一致）；**tier 须为 pro**；**schemaVersion 须为 3**（兼容 2）；meta.packProfile 须为 director|industrial。
3. full_pack 须含非空：meta · visualStyle · coreConflict · scenes · characters · **props[]**（≥1）· shots · handoff（≥6 行）。
4. creative Pass1（非 film_pull）**硬性**：shots[] 必须 **完整 12–18 镜**（推荐 15 镜），各镜 durationSec **10–15 整数**，合计 **175–185 秒**（推荐 15×12=180）。**禁止**照抄上方示例只交 2～3 镜样例；示例仅示意字段形状与 **对白⇔characterIds 成对**写法。shots[] 禁止 imagePrompt / videoPrompt / frameImagePrompt。
4a. **首轮最易失败三项（缺任一项即校验失败）**：
   - **对白镜必写 characterIds**：dialogue 非「—」⇒ 同镜 \`characterIds: ["characters[].id"]\` 非空（对白角色名须能在 characters[] 找到 id）
   - **资产 imagePrompt 双字面量**：scenes[] / characters[] / props[] **每条** imagePrompt 须同时含「构图规范」与「[视觉风格：…]」
   - **完整镜数**：须输出 12–18 镜全集，勿只交示例镜数
5. Pass1 字段金标准见 docs/画布提示词.md（运镜/光影/画面描述/音效/角色/场景/道具块结构）。
${STORY_PRO2_JSON_FIELD_RULES}
6. 无有效 JSON 围栏或校验失败 → 任务失败；程序由 JSON 渲染人读 Markdown，**禁止**输出 GFM。`;

/** 简版 · 现网导演表（packProfile=director） */
export const STORY_PRO2_PACK_PROFILE_DIRECTOR_RULES = `【制作档 · 简版 director】
- meta.packProfile 必须为 \`director\`；meta.source 默认 \`creative\`；schemaVersion=3。
- 只填导演表：shotSize / lighting / cameraMove / sceneDescription / dialogue / durationSec / sfxNote / audioNote / sceneId / characterIds / propIds。
- **禁止**输出 shots[].analysis（整块省略）。
- Pass1 禁止 imagePrompt / videoPrompt / frameImagePrompt。
- **时长硬性（creative）**：必须输出完整 **12–18 镜**（推荐 15），每镜 durationSec **10–15**，合计 **175–185**（推荐 180）。禁止只输出 1～2 镜示例即停。
- **对白⇔characterIds（逐镜成对）**：dialogue 非「—」时 **必须** 同镜写 \`characterIds: ["…"]\`（characters[].id）；无对白镜可 \`characterIds: []\` 或省略。
- **资产 imagePrompt**：scenes[] / characters[] / props[] 每条 imagePrompt **必须** 含字面量「构图规范」与「[视觉风格：…]」（见 patch 示例镜 1 / 场景辞典 / 道具辞典）。
- scenes[].colorBlock / shots[].colorBlock 若有则须为对象 { primary, … }，禁止字符串。`;

/** 专业版 · 导演表 + analysis */
export const STORY_PRO2_PACK_PROFILE_INDUSTRIAL_RULES = `【制作档 · 专业版 industrial】
- meta.packProfile 必须为 \`industrial\`。
- 导演表字段与简版相同，且每镜必须含 \`analysis\`：
  - analysis.cut.transition / cut.detail
  - analysis.cinematography.cameraAngle / focalLength / composition
  - analysis.blocking.subjectBlocking / sightDirection / foreMidBackLayer / sceneEnvironment / dynamicProps
  - analysis.look.lightingSetup / toneContrast
  - analysis.narrative.function / rhythmWeight
- 非末镜 cut.detail 禁止「无」。
- Pass1 禁止 frameImagePrompt / videoPrompt；视觉草稿只写 analysis.analysisDraftPrompt。
- source=creative 时仍须完整 **12–18 镜**、合计 **175–185** 秒（禁止照抄示例只交 2 镜）。`;

/** 专业版 + 上游视频拉片 */
export const STORY_PRO2_FILM_PULL_INPUT_RULES = `【输入模式 · 视频拉片 film_pull】
- meta.source 必须为 \`film_pull\`；meta.packProfile 必须为 \`industrial\`；schemaVersion=3。
- 客观写实：每次硬切 = 一镜；禁止发明原片没有的镜头或剧情。
- 须填 meta.totalDurationSec、shootingPrep（venue/costume/props/equipment）、三块长文（narrativeLogic / beatPoints / replicableShootingScript），长文不得超集 JSON。
- 每镜 analysis.timing.startTimeSec / endTimeSec 连续；时长跟原片，**不要**套 12–18 镜或 175–185 秒。
- 半数以上镜 sceneEnvironment 须有可观测内容；venue 禁止「无」。
- characters / scenes / props 可空（可从画面升格，勿编造完整四视图若视频不足以支撑）。
- 用户 Dock 附加要求须遵守，但不得违背跟片客观性。`;

export function resolvePro2PackProfilePromptRules(opts: {
  packProfile?: string | null;
  source?: string | null;
}): string {
  const industrial = opts.packProfile === "industrial";
  const filmPull = opts.source === "film_pull";
  const parts = [
    industrial
      ? STORY_PRO2_PACK_PROFILE_INDUSTRIAL_RULES
      : STORY_PRO2_PACK_PROFILE_DIRECTOR_RULES,
  ];
  if (filmPull && industrial) {
    parts.push(STORY_PRO2_FILM_PULL_INPUT_RULES);
  }
  return parts.join("\n\n");
}

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

/** 场景 · 2×2 四视角空镜 · 构图规范全文（Dock / 生图关键词列共用） */
export const PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC = `高质量专业场景设定图，横向构图，以 2 行 2 列的干净网格四等分整齐排版，每个格子都是独立的 16:9 横向画面，展示同一场景的四个大全景视角（1为正面中心线大全景视图，镜头正对场景中心轴，构图严格居中，画面同时包含顶面与底面，尽量展示完整空间层次、更多环境细节和深景深；2以1的中心线为参考，摄像机移动到场景左前方45度位置的大全景视图，镜头仍对准场景核心区域；3为以1的中心线为参考，摄像机移动到场景右前方45度位置的大全景视图；4为镜头在室内最深处向外拍摄的正中心全景图。四个视角也可以是东南西北四个方位的视角。四个视角必须表现同一地点、同一时间、同一天气、同一光源、同一空间结构和同一美术风格。环境清晰，细节丰富，景深较深，光影自然，专业摄影，超清画质。不得出现任何人物（这是空场景参考图，必须空无一人），也不得出现人群、背影、剪影、人脸、手脚、人物倒影、人物影子、照片人物、屏幕人物、镜中人物、剧情事件、人物活动；不得让四个视角表现成四个不同场景；不得改变建筑结构、空间比例、主体位置、材质、色彩、天气、时间段或光源方向；画面构图不得倾斜、透视畸变、广角畸变、变形、扭曲；不得出现鱼眼视角、斜角、极端俯视、极端仰视；正面视图必须居中、对称、中心线构图；左前方 45 度、右前方 45 度和背后视角必须保持镜头稳定、空间连贯、比例一致；禁止模糊、低画质；禁止景深太浅；不得出现文字、水印、签名、边框、标签、UI元素、杂乱元素。`;

/** 场景生图关键词(英文) 列 · 金标准撰写规范 */
export const PRO2_SCENE_IMAGE_PROMPT_GOLDEN_RULES = `# 场景 · 生图关键词(英文) 列撰写规范（金标准）

列内写 **中文**，结构：
名称：（场景名称），（室内/室外），（宏观/微观）
描述：（室内/室外、时间、天气、高度约X米、宽度约X米等）
前背景：（前景层描述）
氛围：（威严压抑/温馨浪漫/紧张悬疑等）
构图规范：${PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC}
末尾追加 \`[视觉风格：xxx]\``;

/** 角色 · description / clothing / traits 撰写规范（JSON · 金标准 docs/画布提示词.md） */
export const PRO2_CHARACTER_APPEARANCE_COLUMN_RULES = `【角色视觉辞典 · JSON 撰写规范 · ${STORY_PRO2_JSON_ONLY_MARKER}】

须写 **description · clothing · traits**（或 appearance 内显式 ①②③），**禁止**「标志性动作」：

① description / 外貌：（年龄/性别/身高/体型/脸型/发色发型/瞳色/肤色）
   示例：女，28岁，身高1.65米，偏瘦，瓜子脸，中长发干枯黑色，黑瞳，肤色苍白

② clothing / 服装：（上衣/下装/鞋袜/帽子/配饰，逐项列出）
   示例：宽松浅灰色条纹衬衫，黑色西装长裤，黑色平底皮鞋，无帽无配饰

③ traits / 特征（强制 ≥3 项）：（面部独特特征/体态特征/疤痕/痣/茧/纹路等 · **固定外貌细节**）
   示例：①眼下明显黑眼圈呈青紫色 ②双颊微陷颧骨略突出 ③右手食指与中指内侧有薄茧

**硬性禁止**：
- **禁止** 在本列写「标志性动作」（动作/表演属分镜与性格，不是角色设定图字段）
- **禁止** 把 ①②③ 合并成一段；JSON 须同时提供 description / clothing / traits 字段（或 appearance 内显式 ①②③）
- 禁止泛化/情绪化/场景化描述（见特征禁止项）

特征禁止项：
- 禁止泛化描述：如"气质出众""面容清秀""看起来很有故事"
- 禁止情绪化描述：如"面带愁容""眼神忧伤"（特征应固定，不随情绪变化）
- 禁止场景相关描述：如"衣袖沾了墨渍""头发被风吹乱"`;

/** 角色四视图 · 构图规范全文（Dock / AI生图列共用） */
export const PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC = `高质量专业角色设定图，横向构图，纯白色纯净背景，中性摄影棚灯光，平光布光；布局结构（必须是角色四视图）：正面面部头部特写（占图片水平 1/3 的空间）+ [全身正面视图 + 全身左侧面视图 + 全身背面视图]（占图片水平剩余的 2/3 的空间，并列排列），四个视图中间用淡灰色(#E2E2E2)的2px细线分割，无任何道具或背景物体。光影：中性摄影棚灯光，柔和的前侧光，清晰的轮廓定义，自然的肤色，面部清晰服装可辨识，平视镜头，完整全身，无裁剪。不得出现任何道具/武器/食物/饮料/手持物（角色必须空手）；不得出现复杂动作、情绪表情、面部遮挡；不得出现环境背景（仅白色）；不得出现其他角色；确保所有视图中的面部特征、发型、体型和服装保持一致；不得出现文字、水印、标签、UI元素；无背景场景，无过度风格化，纯素颜样貌。`;

/** 角色 AI生图提示词(英文) 列 · 金标准撰写规范 */
export const PRO2_CHARACTER_IMAGE_PROMPT_GOLDEN_RULES = `# 角色 · AI生图提示词(英文) 列撰写规范（金标准）

列内写 **中文**，结构（段落之间空一行）：
名称：（角色全名），（身份/定位）
描述：（性别），（年龄），（身高），（体型），（发型/发质/发色），（脸型），（瞳色），（肤色）
服装：（上衣、下装、鞋袜、帽子、配饰等，逐项列出）
特征：（≥3 项固定面部/体态/细节特征，禁止泛化/情绪化/场景化描述）
构图规范：${PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC}
末尾追加 \`[视觉风格：xxx]\`（与视觉风格总纲一致）`;

/** 道具 · 2×3 六视图 · 构图规范全文（Dock / 道具生图提示词列共用） */
export const PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC = `高质量写实道具多角度展示图，横向构图，以 2 行 3 列的干净网格整齐排版，展示道具的六个极正视角。纯白色纯净背景，专业产品影棚摄影，标准六视图参考。六视图包括（必须是道具六视图）：绝对正前方视图、绝对正后方视图、绝对左侧视图、绝对右侧视图、绝对正上方俯拍视图、绝对正下方仰拍视图。所有视图必须是同一件道具，材质、颜色、比例、结构完全一致。使用超长焦镜头或移轴镜头效果，将透视变形降到最低，物体所有本该平行的边缘在画面中保持平行，接近正交投影。每个视图都像在专业产品影棚中用三脚架精密校准拍摄，构图绝对端正，物体在每个格子中居中，无任何倾斜、旋转或透视畸变。画面出不得出现任何人物、角色、人群、人影等；不得出现手、脚、人脸、场景、建筑、自然景观；无其他道具；必须无文字、无水印、无 logo、无 UI 元素，不要任何剧情事件，保持道具本体清晰、保持完整轮廓、保持所有角度的材质和结构一致。`;

/** 道具生图提示词 列 · 金标准撰写规范 */
export const PRO2_PROP_IMAGE_PROMPT_GOLDEN_RULES = `# 道具 · 道具生图提示词 列撰写规范（金标准）

列内写 **中文**，结构：
名称：（道具名），（分类/用途）
描述：（材质、颜色、尺寸、结构细节，逐项列出）
特征：（关键识别特征，1-2句）
构图规范：${PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC}
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
export const STORY_PRO2_PACK_OUTPUT_RULES = `【制作包硬性约束 · JSON-only v13 · ${STORY_PRO2_JSON_ONLY_MARKER} · ${STORY_PRO2_PACK_V8_MARKER}】
1. **只输出** \`\`\`pro2-production-script\` JSON 围栏；**禁止** Markdown/GFM/说明文字。
2. 须 **完整保留** 上传剧本中已有场景、人物与对白，只做结构化整理，不得压缩成梗概。
3. full_pack patch 须含：meta · visualStyle · coreConflict · scenes · characters · props[]（≥1）· shots · handoff（≥6 行）。
4. **分镜 Pass1** 须 **12–18 镜**（总时长 175–185 秒）；每镜 **10–15 秒**整数；shots[] **禁止** imagePrompt / videoPrompt / frameImagePrompt。
5. 每镜必填：shotSize · lighting(≥8字) · cameraMove(≥12字) · sceneDescription（【起始】…【结束】≥30字）· **sceneId**（须引用 scenes[].id）· **characterIds**（dialogue 非「—」时必须非空，且为 characters[].id）· **propIds**（画面出现可交互道具时必填，须引用 props[].id）· dialogue · durationSec · sfxNote · audioNote；sceneDescription 中出现角色/场景/道具时须使用资产辞典 **canonical name**（与 sceneId/characterIds/propIds 一致）。
5a. **场景绑定**：每镜 **sceneId 唯一对应当镜主场景**；剧本有多场景时 **禁止** 全片共用同一 sceneId。lighting 首句须含该镜 scenes[].**name** 或 environmentTimeMood 中的 **时代+时段** 关键词（如「深夜」「白日」「黄昏」），且与同镜 sceneId 一致；场景切换后 sceneId 必须变更。
5b. **imagePrompt 字面量硬性（scenes / characters / props 每条）**：imagePrompt 字符串内必须同时出现「构图规范」与「[视觉风格：…]」两段字面量；缺任一即失败。场景=四视角规范，角色=四视图规范，道具=六视图规范；禁止只写名称/氛围省略这两段。
5c. **对白⇔characterIds 成对（逐镜 · 高频失败项）**：凡 dialogue 非「—」，**同一镜** 必须写 \`"characterIds": ["char-xxx"]\`（xxx 为对白说话人在 characters[] 中的 id）；写台词却缺/空 characterIds 即失败。无对白镜：dialogue 写「—」，characterIds 可 []。
6. characters[] 须 description · clothing · traits（≥3 项）；imagePrompt 须含四视图构图规范 + [视觉风格：…]（见 docs/画布提示词.md）。
7. scenes[] / props[] 的 imagePrompt 须含对应构图规范 + [视觉风格：…]（props[].imagePrompt 不得省略）。
8. 「对白」撰写规范：
${STORY_PRO2_DIALOGUE_COLUMN_RULES}
9. 「运镜」撰写规范：
${STORY_PRO2_CAMERA_MOVE_COLUMN_RULES}
10. Pass1 字段范例（运镜/光影/画面描述/音效）见 PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE。
11. ${STORY_PRO2_PACK_LANGUAGE_RULES.replace(/^# .+\n\n/, "").trim()}`;

/** 首轮 LLM 输出前自检 · 降低 PRO2_SCRIPT_JSON_INVALID 首轮失败率 */
export const STORY_PRO2_PARSE_SELF_CHECK_RULES = `【提交前自检 · 输出 JSON 前逐条核对】
1. **characterIds（逐镜）**：扫描 shots[]——凡 dialogue 非「—」，同镜 characterIds 必须非空且为 characters[].id
   ✗ dialogue 有台词但缺 characterIds / characterIds 为 []
   ✓ "dialogue": "沈昭昭（疲惫）：\\"…\\"", "characterIds": ["char-heroine"]
2. **imagePrompt 字面量（逐条资产）**：scenes[] / characters[] / props[] 每条 imagePrompt 须同时含「构图规范」与「[视觉风格：」
   ✗ 只有名称/描述/氛围，无上述两字面量
   ✓ …构图规范：（四视图/四视角/六视图规范全文）。[视觉风格：…]
3. **propIds**：画面描述出现道具 canonical name ⇒ propIds 须引用 props[].id
4. **镜数时长**：creative 须完整 **12–18 镜**，各镜 durationSec **10–15**，合计 **175–185** 秒
5. **sceneId**：每镜必填；多场景剧本禁止全片同一 sceneId`;

/** 首轮最后读到的硬性三门 · 放在 prompt 最末尾（recency） */
export const STORY_PRO2_FIRST_ATTEMPT_HARD_GATES = `【首轮硬性三门 · 缺任一条即 PRO2_SCRIPT_JSON_INVALID · 输出前最后核对】
① **对白 ⇔ characterIds 成对**（逐镜）
   - dialogue 含角色台词 ⇒ 同镜必须写 characterIds: ["characters[].id"]
   - 从对白「角色名（情绪）："台词"」反查 characters[].name → id
   ✗ 镜 10 有对白但 characterIds 缺失/为空
   ✓ 见 JSON 示例镜 1（沈昭昭 + char-heroine）与镜 3（萧景珩 + char-prince）
② **资产 imagePrompt 双字面量**（scenes / characters / props 每条）
   - 必须同时含 substring「构图规范」与「[视觉风格：」
   ✗ 场景/道具只写「名称+描述+氛围」无上述字面量
   ✓ 见 JSON 示例 scenes[].imagePrompt / props[].imagePrompt 写法
③ **完整 12–18 镜**（creative）
   - 示例仅 3 镜示意字段；实际须输出完整 12–18 镜，合计 175–185 秒
   ✗ 只交 2～3 镜样例即停`;

/** Pass1 导演表字段金标准 · 源：docs/画布提示词.md · docs/大模型剧本提示词.md §五 */
export const PRO2_CANVAS_PASS1_SHOT_FIELD_GUIDE = `# Pass1 导演表字段（v2 · 每镜必填 · ${STORY_PRO2_PACK_V8_MARKER}）

## 运镜
固定机位，微小手持晃动增加压抑感（须 ≥12 字；禁止单/双字；须含机位状态+运动方向+速度+视觉目的）

${STORY_PRO2_CAMERA_MOVE_COLUMN_RULES}

## 光影
深夜室内，极低饱和度的冷蓝光影，压抑沉闷的社畜氛围（须 ≥8 字；**首句须含本镜 scenes[].name 或 environmentTimeMood 的时代/时段词**，与同镜 sceneId 一致）

## 画面描述（→ sceneDescription）
【起始】在伏案加班，双手飞速敲击着，屏幕刺眼的蓝光照在她苍白的脸上。【结束】保持伏案姿势，视线锁定屏幕（须含【起始】…【结束】，≥30 字）

## 音效（→ sfxNote）
急促而沉重的键盘敲击声，微弱的空调底噪

## 道具（→ 道具列写名称 · JSON propIds）
电脑（须在 props[] / 道具视觉辞典 中定义；propIds 须引用 props[].id）

## 场景（→ JSON sceneId）
现代深夜办公室（须在 scenes[] 中定义 canonical name；sceneId 须引用 scenes[].id；**每镜必填**；多场景剧本须按镜切换 sceneId）

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
