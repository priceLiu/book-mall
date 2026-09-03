import {
  buildSeedVideoStyleChoiceJsonExample,
  loadSeedVideoSkillMd,
  resolveSeedVideoSkillKey,
  type SeedVideoSkillKey,
} from "@/lib/ecom/ecom-seed-video-skills";

/** 嵌入 system prompt 的 JSON 契约（与 table-format.md 一致；Step4 style 示例按 Skill 注入） */
function buildSeedVideoJsonContract(skillKey: SeedVideoSkillKey): string {
  const styleExample = buildSeedVideoStyleChoiceJsonExample(skillKey);
  return `
## 【最高优先级】机器可读交付 · 仅 \`\`\`seed-video JSON

**系统只解析 \`\`\`seed-video 围栏内的 JSON。** 禁止 Markdown 分镜表 / 前言 / 闲聊；用户可读内容由系统根据 JSON 渲染。

### 必须

1. 回复**整段**仅为唯一围栏 \`\`\`seed-video（语言标记必须是 seed-video，禁止用 json/product-design 代替）；
2. JSON 根对象必须含 **\`step\`** 与 **\`action\`**；
3. 只写当前步骤字段；JSON 禁止注释与尾逗号。

缺围栏、JSON 非法、必填字段缺失 → 用户无法点选、无法同步（视为失败输出）。

### 全局 step / action 对照

| step | action | 必填字段 |
|------|--------|----------|
| scripts | await_script_choice | materialAnalysis + scripts(长度=3) |
| mode | await_mode_choice | modeOptions(长度=2) |
| style | await_style_choice | styleOptions(长度=2) |
| directPlan | await_direct_plan_confirm | directPlan.shotSequence + directPlan.configTable |
| storyboard | await_storyboard_review | shotSequence |
| formalShots | await_formal_shots_confirm | shots + configTable |

### 固定枚举（禁止改名）

- scripts[0].id=script-1, label=脚本一；scripts[1].id=script-2, label=脚本二；scripts[2].id=script-3, label=脚本三
- modeOptions[0].id=direct；modeOptions[1].id=fine
- styleOptions[0].id=sweet-xhs；styleOptions[1].id=sharp-douyin
- configTable 七键：globalPrompt, fullVoiceover, voiceTone, bgmPreset, durationSec, aspectRatio, materialUsage

### Step2 完整示例

\`\`\`seed-video
{
  "step": "scripts",
  "action": "await_script_choice",
  "materialAnalysis": {
    "productSummary": "棕色挂脖上衣 + 碎花半裙套装",
    "sellingPoints": ["挂脖显瘦", "高腰 A 字裙摆"],
    "sceneTags": ["自然光庭院", "度假松弛感"],
    "styleTone": "清冷文艺种草",
    "materials": [
      { "ref": "@图片1", "description": "门头全身" },
      { "ref": "@图片2", "description": "倚靠栏杆中景" }
    ]
  },
  "scripts": [
    {
      "id": "script-1",
      "label": "脚本一",
      "title": "氛围感切入‑不费力的高级",
      "summary": "逃离城市的喧嚣，找个安静的角落放空。",
      "rows": [
        {
          "beatIndex": 1,
          "duration": "5s",
          "refImageLabel": "@图片1",
          "sceneDescription": "门头全身，自然光",
          "voiceover": "逃离城市的喧嚣，找个安静的角落放空。"
        }
      ]
    },
    {
      "id": "script-2",
      "label": "脚本二",
      "title": "痛点切入‑梨形身材天菜",
      "summary": "挂脖设计露锁骨，显瘦又带点小性感。",
      "rows": [
        {
          "beatIndex": 1,
          "duration": "5s",
          "refImageLabel": "@图片4",
          "sceneDescription": "室内镜子近景",
          "voiceover": "挂脖设计露锁骨，显瘦又带点小性感。"
        }
      ]
    },
    {
      "id": "script-3",
      "label": "脚本三",
      "title": "场景切入‑度假出片指南",
      "summary": "不用刻意摆拍，走路就是风景。",
      "rows": [
        {
          "beatIndex": 1,
          "duration": "6s",
          "refImageLabel": "@图片3",
          "sceneDescription": "行走动态全身",
          "voiceover": "不用刻意摆拍，走路就是风景。"
        }
      ]
    }
  ]
}
\`\`\`

### Step3 mode 示例

\`\`\`seed-video
{
  "step": "mode",
  "action": "await_mode_choice",
  "modeOptions": [
    { "id": "direct", "label": "方案①：直接连贯生成视频", "description": "一条连贯成片，适合快节奏种草" },
    { "id": "fine", "label": "方案②：按精细成片流程制作", "description": "逐镜 I2V + TTS + 合成" }
  ]
}
\`\`\`

### Step4 style 示例（仅方案② · 当前 Skill）

\`\`\`seed-video
${styleExample}
\`\`\`

### 方案① directPlan 示例

\`\`\`seed-video
{
  "step": "directPlan",
  "action": "await_direct_plan_confirm",
  "directPlan": {
    "shotSequence": [
      { "index": 1, "timeSlice": "0-5s", "refImageLabel": "@图片1", "sceneDescription": "固定机位全身", "voiceover": "…", "durationSec": 5 },
      { "index": 2, "timeSlice": "5-12s", "refImageLabel": "@图片3", "sceneDescription": "行走中景", "voiceover": "…", "durationSec": 7 },
      { "index": 3, "timeSlice": "12-20s", "refImageLabel": "@图片2", "sceneDescription": "倚靠特写", "voiceover": "…", "durationSec": 8 }
    ],
    "configTable": {
      "globalPrompt": "9:16 竖屏，自然光，度假氛围…",
      "fullVoiceover": "完整口播…",
      "voiceTone": "女声，温暖舒缓",
      "bgmPreset": "轻音乐，吉他或钢琴",
      "durationSec": 20,
      "aspectRatio": "9:16",
      "materialUsage": "@图片1→@图片3→@图片2→@图片4"
    }
  }
}
\`\`\`

### 方案② formalShots 示例

\`\`\`seed-video
{
  "step": "formalShots",
  "action": "await_formal_shots_confirm",
  "shots": [
    {
      "index": 1,
      "timeSlice": "0-5s",
      "refImageLabel": "@图片4",
      "sceneDescription": "缓慢推镜，午后柔光",
      "videoPrompt": "参考@图片4，推镜，9:16竖版…",
      "voiceover": "姐妹们，谁说微胖女生不能穿吊带？",
      "durationSec": 5
    }
  ],
  "configTable": {
    "globalPrompt": "整体定调…",
    "fullVoiceover": "…",
    "voiceTone": "…",
    "bgmPreset": "…",
    "durationSec": 20,
    "aspectRatio": "9:16",
    "materialUsage": "…"
  }
}
\`\`\`
`.trim();
}

/** 每条助手请求末尾追加（服务端强制） */
export const SEED_VIDEO_JSON_DELIVERY_FOOTER = `
---
【交付格式 · 强制 · 最高优先级】
1. 回复**整段**仅为唯一围栏 \`\`\`seed-video ，内含**完整合法 JSON**（含 step + action；无注释、无尾逗号）。
2. **禁止** Markdown 分镜表、列表、前言或闲聊；展示由系统根据 JSON 渲染。
3. 围栏语言标记必须是 \`seed-video\`，**禁止** \`json\` / \`media-decompose\` 等代替。`.trim();

export function appendSeedVideoJsonDeliveryFooter(userText: string): string {
  const base = userText.trim();
  if (!base) return SEED_VIDEO_JSON_DELIVERY_FOOTER;
  if (base.includes("【交付格式 · 强制")) return base;
  return `${base}\n\n${SEED_VIDEO_JSON_DELIVERY_FOOTER}`;
}

export function buildSeedVideoSystemPrompt(opts: {
  skillKey?: SeedVideoSkillKey | string;
  targetDurationSec: number;
  aspectRatio: string;
  materialCount: number;
  workflowContext?: string;
}): string {
  const skillKey = resolveSeedVideoSkillKey(opts.skillKey);
  const skill = loadSeedVideoSkillMd(skillKey);
  const workflowBlock = opts.workflowContext?.trim()
    ? `\n${opts.workflowContext.trim()}\n`
    : "";
  return `${skill}

---

## 运行时上下文（界面已选定，勿重复追问）
- 当前 Skill：${skillKey}
- 目标成片时长：**以用户 Prompt 为准**（须从用户指令解析秒数；用户未说明时默认 **20 秒**）。当前解析参考：${opts.targetDurationSec} 秒（若与用户 Prompt 不一致，以 Prompt 为准；方案① \`directPlan.configTable.durationSec\` 须与用户目标一致）
- 画幅：${opts.aspectRatio}
- 已上传素材图：${opts.materialCount} 张（@图片1 对应第 1 张上传顺序，依此类推）
${workflowBlock}

## 界面交互规则（摘要）

- 用户**只能**点选卡片；禁止「请回复编号/请勾选」。
- **整段回复仅为 \`\`\`seed-video JSON**；禁止 Markdown 分镜表/前言；展示由系统渲染。
- Step2 \`scripts\` 每套 \`rows\` 字段：beatIndex / duration / refImageLabel / sceneDescription / voiceover。
- 方案①/②：shotSequence 或 shots + configTable 七键。
- 每步只输出当前步；禁止跳步、禁止重复已完成的「请选择脚本/制作模式」。
- 用户点选「确认逐镜参数表，同步到中间工作区」后由系统本地同步；禁止再输出「同步成功」等二次确认。
- 「导出提示词包 / 结束创作」等**仅**在成片渲染完成后出现。

${buildSeedVideoJsonContract(skillKey)}`;
}
