/**
 * 古风甜宠 · DeepSeek 控制台验证过的全量制作包 prompt
 * 与 docs/大模型剧本提示词.md · pro2-production-pack-standard v8 对齐
 * book-mall/lib/canvas/data/pro2-gu-feng-deepseek-full-pack-prompt.ts 须保持同步
 */

import {
  PRO2_DEFAULT_SHOT_GFM_EXAMPLE,
  STORY_PRO2_PACK_OUTPUT_RULES,
  STORY_PRO2_PACK_V8_MARKER,
  STORY_PRO2_PROP_TABLE_HEADER,
  STORY_PRO2_SCENE_TABLE_HEADER,
  STORY_PRO2_CHARACTER_TABLE_HEADER,
  STORY_PRO2_STORYBOARD_TABLE_HEADER,
  STORY_PRO2_JSON_OUTPUT_CONTRACT,
} from "./pro2-production-pack-standard";

/** Gateway system · 角色设定 */
export const PRO2_GU_FENG_DEEPSEEK_SYSTEM_PROMPT = `角色设定：你是精通古风甜宠与短视频节奏的顶级短剧编剧，输出必须具有强画面感与情绪煽动力。

输出语言：表头含 (英文) 仅为解析兼容；表格单元格默认全部中文，非必要禁止英文（占位符/HEX/技术缩写除外）；反向词须中文顿号列表。`;

/** Gateway user · 规则 + 样例（故事大纲由 textInputs 追加） */
export const PRO2_GU_FENG_DEEPSEEK_FULL_PACK_USER_PROMPT = `# 古风甜宠短剧 · 完整制作包（${STORY_PRO2_PACK_V8_MARKER}）

${STORY_PRO2_PACK_OUTPUT_RULES}

# 须输出的 GFM 章节（表头逐字一致）
## 视觉风格总纲
## 场景视觉辞典
${STORY_PRO2_SCENE_TABLE_HEADER}
## 核心冲突与结构摘要
## 角色视觉辞典
${STORY_PRO2_CHARACTER_TABLE_HEADER}
## 道具视觉辞典
${STORY_PRO2_PROP_TABLE_HEADER}
## 分镜脚本
${STORY_PRO2_STORYBOARD_TABLE_HEADER}
## 下一步交接清单

- 须 **12–18 镜**；总时长 **175–185 秒**；每镜 **10–15 秒**
- Pass1 **禁止** AI生图/AI视频 列

${PRO2_DEFAULT_SHOT_GFM_EXAMPLE}

${STORY_PRO2_JSON_OUTPUT_CONTRACT}`;

export const PRO2_GU_FENG_DEEPSEEK_STORY_INPUT_PREFIX =
  "【以下为故事大纲，请严格按上述规则生成完整制作包】";
