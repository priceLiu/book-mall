/**
 * 古风甜宠 · 下游生图/生视频提示词规范（写入 GFM 各列时遵循）
 * 与 docs/大模型剧本提示词.md · pro2-production-pack-standard v8 对齐
 */
import {
  PRO2_UNIVERSAL_NEGATIVE,
  STORY_PRO2_VIDEO_PROMPT_RULES,
} from "./pro2-production-pack-standard";

/** 角色段 · AI生图提示词(英文) 列 + 三视图下游 */
export const PRO2_GU_FENG_CHARACTER_IMAGE_RULES = `# 古风 · 角色生图规范（写入「AI生图提示词(英文)」列）

- 须含 **四视图构图规范**（正面特写 + 全身正/侧/背）+ \`[视觉风格：…]\`
- **严格锁定**：五官、发型、服装须与角色视觉辞典完全一致
- 禁止道具/武器/手持物；纯白背景；禁止英文段落`;

/** 场景段 · 生图关键词 / AI生图提示词 */
export const PRO2_GU_FENG_SCENE_IMAGE_RULES = `# 古风 · 场景生图规范（写入场景辞典·生图关键词 列）

- 须含 **2×2 网格四视角**构图规范 + \`[视觉风格：…]\`
- 默认纯环境空镜；禁止人物 unless 大纲已标 **【含人物】**
- 禁止英文段落`;

/** 分镜段 · Pass2 videoPrompt 增补 */
export const PRO2_GU_FENG_VIDEO_SHOT_RULES = `${STORY_PRO2_VIDEO_PROMPT_RULES}

# 古风 Pass2 增补
- 参考图规则须含场景多视图/道具正反面逻辑（见 docs/大模型剧本提示词.md）
- 甜宠高光可加柔光粉滤镜描述；快切镜须写明 BGM 音量 dB`;

/** 全剧 Negative · 追加至各镜 videoPrompt 末尾【反向】中文块 */
export const PRO2_GU_FENG_UNIVERSAL_NEGATIVE = PRO2_UNIVERSAL_NEGATIVE;
