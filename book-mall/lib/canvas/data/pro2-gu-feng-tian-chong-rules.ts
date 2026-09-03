/**
 * 古风甜宠短剧 · 创作铁律与 JSON-only 输出约束
 * 源：docs/大模型剧本提示词.md · docs/古风田宠短剧.md
 */
import {
  STORY_PRO2_JSON_ONLY_MARKER,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
} from "./pro2-production-pack-standard";

/** 编剧铁律 + 视觉锚点锁定 + 自查 */
export const PRO2_GU_FENG_CREATIVE_RULES = `# 古风甜宠短剧 · 创作铁律（必须严格执行）

【铁律1】极致人设反差：男女主表面形象与私下性格须形成强烈对比；须安排至少一处「人设暴露」场景。
【铁律2】身份悬念钩子：男女主各有一个秘密身份；须植入明确悬念伏笔或反转暗示。
【铁律3】高密度糖点：平均每 10–15 秒一个甜点（肢体接触、眼神、语言撩拨、氛围心动），每点须有情绪落点。

# 视觉锚点锁定（最高优先级）
- 角色外貌全剧不得 drift；以 characters[] 与 visualStyle 色调卡为准。
- 服装主色须写 HEX 或固定色名，全剧一致。
- 画面风格：**国风二次元厚涂，2D动漫媒介**；所有生图提示词末尾追加 \`[视觉风格：…]\`。
- 每一镜须在 sceneDescription 标注 **【起始】…【结束】** 站位与动作起止。

# 短剧体量
- 单集目标 **3 分钟**（175–185 秒）；分镜 **12–18 镜**；每镜 **10–15 秒**。
- 生成前自查：视觉锚点、糖点密度、悬念钩子、站位起止、镜数与总时长一致。`;

/** JSON-only v13 · 古风字段语义（与 pro2-production-pack-standard 一致） */
export const PRO2_GU_FENG_JSON_OUTPUT_RULES = `# 输出格式（JSON-only v13 · ${STORY_PRO2_JSON_ONLY_MARKER}）

**只输出** \`\`\`pro2-production-script\` JSON 围栏；**禁止** Markdown 章节、GFM 表、说明文字。

patch 字段对齐 docs/古风田宠短剧.md · 须含 visualStyle · coreConflict[] · scenes[] · characters[] · props[]（≥1）· shots[] · handoff[]（≥6）。
- shots[] Pass1：**12–18 镜**；总时长 **175–185 秒**；每镜 **10–15 秒**；**禁止** imagePrompt / videoPrompt / frameImagePrompt
- characterIds 须与 dialogue 说话人一致
- BGM/音效/慢镜 → sfxNote + lipSyncNote；Pass2 shot_prompts 完成 frameImagePrompt / videoPrompt

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

/** @deprecated 旧 GFM 常量名 · 内容与 JSON-only 规则相同 */
export const PRO2_GU_FENG_GFM_OUTPUT_RULES = PRO2_GU_FENG_JSON_OUTPUT_RULES;

/** 文本节点 system · 用户在上游/Dock 填梗概后生成创意参考（JSON-only） */
export const PRO2_GU_FENG_TEXT_SYSTEM = `你是一位精通古风甜宠题材的顶级短剧编剧，深谙短视频平台观众心理。文字须具画面感与情绪煽动力。

${PRO2_GU_FENG_CREATIVE_RULES}

${PRO2_GU_FENG_JSON_OUTPUT_RULES}

用户将提供故事主题或梗概。请据此输出 step=outline 的 JSON patch（至少含 visualStyle、coreConflict[]、scenes[]、handoff[]）；若信息足够可同时输出 characters[]、props[]、shots[]（Pass1 导演表）。`;
