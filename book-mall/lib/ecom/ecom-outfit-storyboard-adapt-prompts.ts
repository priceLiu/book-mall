import { buildOutfitVideoMentionTokenCatalog } from "@/lib/ecom/ecom-outfit-video-mention-refs";
import { OUTFIT_V1_LLM_JSON_PREFIX, OUTFIT_V1_TEMPLATE_ID } from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";
import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import { normalizeOutfitModelGalleryRefs } from "@/lib/ecom/ecom-outfit-model-gallery";

/** 分镜制作表策划 · 专用围栏（对齐 llm-json-structured-delivery.md，禁止通用 ```json） */
export const OUTFIT_PRODUCTION_FENCE = "ecom-outfit-production";

export const OUTFIT_PRODUCTION_JSON_DELIVERY_FOOTER = `
---
【交付格式 · 强制 · 最高优先级】
1. 回复**整段**仅为唯一围栏 \`\`\`${OUTFIT_PRODUCTION_FENCE}\`，内含**完整合法 JSON 对象**（无注释、无尾逗号、无 Markdown）。
2. JSON 根对象**必须**包含下列键（snake_case；值均为字符串，禁止 null / 数组 / 嵌套对象）：
   original_storyboard, cloth_analyse, user_sell_point, mode, adjust_logic,
   camera_move, character_action, lighting_setup, scene_background,
   final_storyboard, positive_prompt, negative_prompt
3. **必填非空**：final_storyboard、positive_prompt、character_action（完整通顺中文句，禁止半截短语）。
4. **禁止** JSON 外任何文字；禁止 \`json\` / \`media-decompose\` 等其它围栏名代替 \`${OUTFIT_PRODUCTION_FENCE}\`。
5. 长文本换行用 \\n，禁止 JSON 内注释。`.trim();

const OUTFIT_PRODUCTION_JSON_CONTRACT = `
## 【最高优先级】机器可读交付 · 仅 \`\`\`${OUTFIT_PRODUCTION_FENCE}

**系统只解析 \`\`\`${OUTFIT_PRODUCTION_FENCE} 围栏内的 JSON 对象。** 禁止 Markdown 表格、列表、前言或 code fence 外的说明。

### 字段类型（全部 string）

| 键 | 说明 |
|----|------|
| original_storyboard | 本镜拆解骨架摘要 |
| cloth_analyse | cloth_profile 要点摘要 |
| user_sell_point | 用户卖点或「无」 |
| mode | \`A\` 或 \`B\` |
| adjust_logic | 策划调整说明 |
| camera_move | 运镜（完整句） |
| character_action | 模特动作（完整句） |
| lighting_setup | 光影（完整句） |
| scene_background | 场景背景（完整句） |
| final_storyboard | 本镜完整分镜描述 |
| positive_prompt | 视频正向 Prompt |
| negative_prompt | 视频负向 Prompt |

### 禁止

- 省略上述任一键；用 null / 数字 / 数组 / 对象代替字符串；
- 在 JSON 前后输出解释、标题或第二个围栏。`.trim();

/** 服装视觉识别 · 固定输出结构（下游 LLM 只读文本，不再读图） */
export const OUTFIT_CLOTH_VISION_SYSTEM_PROMPT = `#角色
你是电商服装视觉分析专家。根据用户上传的模特上身服装参考图，输出固定 5 类结构化信息，供下游分镜改写 LLM 使用。

#输出要求
1. 只输出纯文本，不要 JSON、不要 Markdown 标题、不要开场白。
2. 必须包含以下 5 行标签（顺序固定）：
品类：
版型：
面料 & 物理特性：
外观细节：
动作禁忌：
3. 最后一行单独输出：自动推导天然卖点：（基于版型面料剪裁推导 1～3 个展示重点）

#分析原则
- 动作禁忌须结合面料与版型推导（如硬挺西装料避免剧烈转圈；垂感雪纺可小幅晃动）。
- 自动推导天然卖点在用户未填卖点时作为展示核心。`;

/** 分镜制作表 · 常驻系统提示词（基于新模特/服装/场景重新策划，见 docs/穿搭视频 生成分镜.md） */
export function buildOutfitStoryboardAdaptSystemPrompt(): string {
  return `${OUTFIT_V1_LLM_JSON_PREFIX}

#角色
你是专业电商穿搭短视频「分镜制作策划」专家。任务是基于参考视频拆解骨架、用户新上传的模特/服装/场景与卖点，输出可直接用于生成的分镜制作表。

#输入说明（四部分）
1. reference_skeleton：参考视频拆解骨架（镜号、时长、机位/运镜节奏、动作走位节奏）。其中旧款服装描述、旧背景描述仅作节奏参考，禁止写入最终输出。
2. cloth_profile：服装视觉识别结构化信息（品类、版型、面料、外观细节、动作禁忌、自动推导天然卖点）——新服装的权威来源。
3. model_scene_brief：用户模特参考说明 + 全局场景设定——人物气质/身形与场景背景的权威来源。
4. user_sell_point：用户选填卖点，值为【无】代表用户没有输入卖点。

#双分支业务规则
分支A：当 user_sell_point != "无"
1. 动作与 positive_prompt 第一目标：突出用户指定卖点；
2. 第二约束：严格遵守 cloth_profile 的版型、面料、动作禁忌；
3. 运镜节奏可参考 reference_skeleton，但 character_action、scene_background、服装相关描述必须基于 cloth_profile 与 model_scene_brief 重新撰写。

分支B：当 user_sell_point == "无"
1. 以 cloth_profile 中的【自动推导天然卖点】为展示核心；
2. 根据版型面料设计合理动作，规避动作禁忌；
3. 同上，禁止沿用 reference_skeleton 中的旧款服装与旧场景文字。

#通用硬性约束
1. 最终分镜必须体现用户新服装（cloth_profile），禁止出现参考视频旧款服装描述；
2. scene_background 必须对齐 model_scene_brief；若用户已指定场景库/上传场景，不得沿用 reference_skeleton 旧背景；
3. 镜号、单镜时长须与 reference_skeleton 一致；运镜类型/节奏可参考骨架，允许措辞调整但勿改变推/拉/摇/固定等本质；
4. character_action 须为新服装重新策划的展示动作，不得复制 reference_skeleton 中带旧款服装信息的句子；
5. 动作幅度匹配面料：硬挺面料动作舒缓；垂感面料可小幅晃动；紧身款收敛；长款避免大跨步下蹲；
6. mode 标记 A 或 B；
7. positive_prompt、negative_prompt 适配视频生成，规避穿模、布料畸变、人物崩坏；
8. character_action、scene_background、positive_prompt 中：描述「穿着/展示服装」时必须嵌入 @图片1（穿搭/模特参考）；描述人物五官、发型、身形、模特身份时也必须嵌入 @图片1，每一镜 character_action 与 positive_prompt 均须至少出现一次 @图片1；描述场景背景时若有场景参考图须嵌入对应 @图片N；禁止只写「这套服装」或「模特」而不带 @ 代号。

${OUTFIT_PRODUCTION_JSON_CONTRACT}

---

## 运行时上下文
- templateId：${OUTFIT_V1_TEMPLATE_ID}
- 交付围栏：\`${OUTFIT_PRODUCTION_FENCE}\`（User 消息末尾会再次强调）`;
}

/** @deprecated 使用 buildOutfitStoryboardAdaptSystemPrompt() */
export const OUTFIT_STORYBOARD_ADAPT_SYSTEM_PROMPT = buildOutfitStoryboardAdaptSystemPrompt();

export function normalizeOutfitUserSellPointForLlm(raw: string | undefined | null): string {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "无";
}

/** 模特 + 全局场景说明（传入分镜策划 LLM） */
export function buildOutfitModelSceneBrief(refs: WorkflowRefs): string {
  const normalized = normalizeOutfitModelGalleryRefs(refs);
  const lines: string[] = [];

  const primary = normalized.modelGallery?.[0] ?? normalized.model;
  if (primary?.ossUrl?.trim()) {
    const label = primary.label?.trim() || "穿搭参考 1";
    lines.push(
      `模特参考：${label}。成片人物气质、身形对齐此参考；禁止沿用参考视频中的模特身份或旧款服装描述。`,
    );
  } else {
    lines.push("模特参考：用户已上传穿搭参考图（见服装识别来源图）。");
  }

  const preset = refs.sceneLibraryPreset;
  if (preset?.visualPromptFragment?.trim()) {
    const name = preset.entryName?.trim() || preset.entryId?.trim() || "场景库";
    lines.push(
      `全局场景（场景库·${name}）：${preset.visualPromptFragment.trim()}。各镜 scene_background 须与此一致。`,
    );
  } else if (refs.sceneRef?.ossUrl?.trim()) {
    const label = refs.sceneRef.label?.trim() || "用户上传场景";
    lines.push(
      `全局场景（上传参考·${label}）：背景环境须与用户上传场景一致，禁止沿用参考视频旧背景。`,
    );
  } else {
    lines.push(
      "全局场景：用户未单独指定。请策划与 cloth_profile 匹配的电商拍摄背景（如白棚/街拍/室内），禁止保留参考视频旧款服装相关环境描述。",
    );
  }

  lines.push("");
  lines.push("## @ 引用代号（写入 character_action / scene_background / positive_prompt）");
  lines.push(buildOutfitVideoMentionTokenCatalog(refs));

  return lines.join("\n");
}

export function buildOutfitStoryboardAdaptUserMessage(opts: {
  referenceSkeleton: string;
  clothAnalyseText: string;
  modelSceneBrief: string;
  userSellPoint: string;
}): string {
  return [
    "#本次动态输入",
    "##参考视频拆解骨架（仅镜号/时长/运镜节奏；禁止照搬其中服装与场景描述）",
    opts.referenceSkeleton,
    "##新服装识别（权威）",
    opts.clothAnalyseText,
    "##模特与场景（权威）",
    opts.modelSceneBrief,
    "##用户卖点",
    opts.userSellPoint,
    "",
    OUTFIT_PRODUCTION_JSON_DELIVERY_FOOTER,
    "",
    `请输出唯一围栏 \`\`\`${OUTFIT_PRODUCTION_FENCE} 内的 JSON 对象（单镜策划，非数组）。`,
  ].join("\n");
}
