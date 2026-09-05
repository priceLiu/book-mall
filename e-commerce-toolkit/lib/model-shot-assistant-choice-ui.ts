import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";
import {
  MODEL_SHOT_COUNT_CHOICE_PREFIX,
  MODEL_SHOT_COUNT_CHOICES,
  MODEL_SHOT_STYLE_CHOICE_PREFIX,
  MODEL_SHOT_STYLE_CHOICES,
  MODEL_SHOT_USAGE_CHOICE_PREFIX,
  MODEL_SHOT_USAGE_CHOICES,
  inferAssistantChoices,
  inferMetaSubStep,
  inferModelShotPhase,
  listModelShotModelModeChoiceMessages,
  listModelShotPropModeChoiceMessages,
  listModelShotSceneModeChoiceMessages,
  listModelShotScenePickChoiceMessages,
  posePlanGenerateChoiceLabel,
} from "@/lib/model-shot-workflow";
import {
  MODEL_SHOT_MODEL_ARCHETYPES,
  MODEL_SHOT_MODEL_CHOICE_PREFIX,
  MODEL_SHOT_MODEL_MODE_PREFIX,
  MODEL_SHOT_PROP_MODE_PREFIX,
  MODEL_SHOT_SCENE_CHOICE_PREFIX,
  MODEL_SHOT_SCENE_MODE_PREFIX,
  parseModelArchetypeChoice,
  parseSceneChoiceLabel,
} from "@/lib/model-shot-prompt-presets";
import type { ModelShotChatMessage, ModelShotProject } from "@/lib/model-shot-types";

export type ModelShotAssistantChoiceStep = {
  title: string;
  subtitle: string;
  progress: string;
};

const MODEL_MODE_DESCRIPTIONS: Record<string, string> = {
  上传参考图: "在中栏模特图区域上传或粘贴参考图",
  AI推荐虚拟模特: "结合服装款式，从三种虚拟模特风格中选 1 个",
  手写描述: "在下方输入框描述模特外貌、身形与气质",
  从模特库选择: "在中栏打开模特库，挑选平台模特",
};

const SCENE_MODE_DESCRIPTIONS: Record<string, string> = {
  上传参考图: "在中栏场景图区域上传背景参考",
  词库推荐: "从内置场景词库中选 1 个推荐场景",
  跳过场景: "不固定背景，出图时由模型自由发挥",
  "AI生成（中栏）": "在中栏场景图卡片点击 AI 生成",
};

const PROP_MODE_DESCRIPTIONS: Record<string, string> = {
  不需要道具: "本次拍摄不使用道具",
  稍后在姿势表填写: "在姿势计划表道具列从词库点选（可应用到全部）",
};

const ACTION_DESCRIPTIONS: Record<string, string> = {
  生成姿势方案: "根据已采集信息生成姿势计划表",
  重新生成姿势方案: "保留元信息，重新生成姿势脚本",
  查看中栏姿势方案: "滚动到中栏核对每条 Prompt",
  确认姿势计划: "锁定计划后进入模特图出图",
  "微调某条 Prompt": "在中栏姿势脚本表点击铅笔编辑",
  重新出图: "在中栏模特图区域逐张或批量生成",
};

function slugId(text: string): string {
  return text.replace(/\s+/g, "-").slice(0, 48);
}

function stripPrefix(message: string, prefix: string): string | null {
  if (!message.startsWith(prefix)) return null;
  return message.slice(prefix.length).trim();
}

function cardFromMessage(project: ModelShotProject, message: string, index: number): SeedVideoAssistantChoice {
  const archetype = parseModelArchetypeChoice(message);
  if (archetype) {
    return {
      id: `model-arch-${archetype.id}`,
      label: archetype.label,
      title: archetype.label,
      message,
      description: archetype.description,
    };
  }

  const scene = parseSceneChoiceLabel(message);
  if (scene) {
    return {
      id: `scene-${scene.id}`,
      label: scene.name,
      title: scene.name,
      message,
      description: scene.visualPrompt,
    };
  }

  const styleLabel = stripPrefix(message, MODEL_SHOT_STYLE_CHOICE_PREFIX);
  if (styleLabel) {
    const hit = MODEL_SHOT_STYLE_CHOICES.find((s) => s.label === styleLabel);
    return {
      id: `style-${slugId(styleLabel)}`,
      label: styleLabel,
      title: styleLabel,
      message,
      description: hit ? hit.styles.join(" · ") : undefined,
    };
  }

  const usageLabel = stripPrefix(message, MODEL_SHOT_USAGE_CHOICE_PREFIX);
  if (usageLabel) {
    const hit = MODEL_SHOT_USAGE_CHOICES.find((u) => u.label === usageLabel);
    return {
      id: `usage-${slugId(usageLabel)}`,
      label: usageLabel,
      title: usageLabel,
      message,
      description: hit ? `${hit.platform} · ${hit.industry}` : undefined,
    };
  }

  const countLabel = stripPrefix(message, MODEL_SHOT_COUNT_CHOICE_PREFIX);
  if (countLabel) {
    const hit = MODEL_SHOT_COUNT_CHOICES.find((c) => c.label === countLabel);
    return {
      id: `count-${slugId(countLabel)}`,
      label: countLabel,
      title: countLabel,
      message,
      description: hit ? `姿势计划表共 ${hit.poseCount} 镜` : undefined,
    };
  }

  const modelMode = stripPrefix(message, MODEL_SHOT_MODEL_MODE_PREFIX);
  if (modelMode) {
    return {
      id: `model-mode-${slugId(modelMode)}`,
      label: modelMode,
      title: modelMode,
      message,
      description: MODEL_MODE_DESCRIPTIONS[modelMode],
    };
  }

  const sceneMode = stripPrefix(message, MODEL_SHOT_SCENE_MODE_PREFIX);
  if (sceneMode) {
    return {
      id: `scene-mode-${slugId(sceneMode)}`,
      label: sceneMode,
      title: sceneMode,
      message,
      description: SCENE_MODE_DESCRIPTIONS[sceneMode],
    };
  }

  const propMode = stripPrefix(message, MODEL_SHOT_PROP_MODE_PREFIX);
  if (propMode) {
    return {
      id: `prop-mode-${slugId(propMode)}`,
      label: propMode,
      title: propMode,
      message,
      description: PROP_MODE_DESCRIPTIONS[propMode],
    };
  }

  if (message === posePlanGenerateChoiceLabel(project.brief?.poseCount ?? 6)) {
    return {
      id: "pose-plan-generate",
      label: message,
      title: message,
      message,
      description: "生成后请在中栏核对姿势脚本表",
      recommended: true,
    };
  }

  return {
    id: `action-${index}-${slugId(message)}`,
    label: message,
    title: message,
    message,
    description: ACTION_DESCRIPTIONS[message],
  };
}

export function buildModelShotAssistantChoiceCards(
  project: ModelShotProject,
  choiceMessages: string[],
): SeedVideoAssistantChoice[] {
  return choiceMessages.map((message, index) => cardFromMessage(project, message, index));
}

export function resolveModelShotAssistantChoiceStep(
  project: ModelShotProject,
): ModelShotAssistantChoiceStep | null {
  const phase = inferModelShotPhase(project);
  const wizard = project.meta?.wizard ?? {};

  switch (phase) {
    case "garment":
      return null;
    case "model":
      if (wizard.modelPick) {
        return {
          title: "选择虚拟模特风格",
          subtitle: "结合服装款式，请选 1 种模特人设",
          progress: "1/4",
        };
      }
      return {
        title: "选择模特方式",
        subtitle: "上传参考图、AI 推荐、手写描述或从模特库选择",
        progress: "1/4",
      };
    case "scene":
      if (wizard.scenePick) {
        return {
          title: "选择场景词库",
          subtitle: "从推荐场景中选 1 个作为背景参考",
          progress: "2/4",
        };
      }
      return {
        title: "选择场景方式",
        subtitle: "上传场景图、词库推荐、跳过或在中栏 AI 生成",
        progress: "2/4",
      };
    case "prop":
      return {
        title: "选择道具方式",
        subtitle: "不需要道具，或稍后在姿势表内填写",
        progress: "3/4",
      };
    case "meta": {
      const sub = inferMetaSubStep(project);
      if (sub === "style") {
        return {
          title: "风格调性",
          subtitle: "选择与本套服装匹配的拍摄气质",
          progress: "4/4 · 1/3",
        };
      }
      if (sub === "usage") {
        return {
          title: "主要用途",
          subtitle: "用于电商主图、种草、lookbook 或广告投放",
          progress: "4/4 · 2/3",
        };
      }
      if (sub === "count") {
        return {
          title: "姿势张数",
          subtitle: "6 张适合标准套图，8 张适合更丰富展示",
          progress: "4/4 · 3/3",
        };
      }
      if (sub === "summary") {
        return {
          title: "生成姿势方案",
          subtitle: "确认采集摘要无误后，一键生成姿势计划表",
          progress: "采集完成",
        };
      }
      return null;
    }
    case "poses":
      return {
        title: "姿势方案",
        subtitle: project.plan.items.length > 0 ? "核对中栏姿势表，可重新生成" : "生成姿势计划表",
        progress: "5/6",
      };
    case "confirm":
      return {
        title: "确认姿势计划",
        subtitle: "锁定计划后，在中栏模特图区域逐张或批量出图",
        progress: "6/6",
      };
    case "generate":
      return null;
    default:
      return null;
  }
}

export function resolveModelShotAssistantHeaderSubtitle(project: ModelShotProject): string {
  const step = resolveModelShotAssistantChoiceStep(project);
  if (step) return `步骤 ${step.progress} · ${step.title}`;
  const phase = inferModelShotPhase(project);
  if (phase === "garment") return "步骤 0/4 · 请先上传服装";
  if (phase === "generate") return "计划已确认 · 出图中";
  return "服装模特图采集";
}

/** 当前步骤选项中，与最近一条用户消息匹配的 message（用于卡片选中态） */
export function resolveModelShotAssistantSelectedMessage(
  project: ModelShotProject,
  messages: ModelShotChatMessage[],
): string | null {
  const choiceMessages = inferAssistantChoices(project);
  if (choiceMessages.length === 0) return null;
  const choiceSet = new Set(choiceMessages);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && choiceSet.has(m.content.trim())) {
      return m.content.trim();
    }
  }
  return null;
}

export function inferModelShotAssistantChoiceCards(
  project: ModelShotProject,
): SeedVideoAssistantChoice[] {
  return buildModelShotAssistantChoiceCards(project, inferAssistantChoices(project));
}

export type ModelShotHistoricalChoiceBlock = {
  cards: SeedVideoAssistantChoice[];
  selectedMessage: string;
  title: string;
};

function resolveHistoricalChoiceMessages(
  trimmed: string,
  project: ModelShotProject,
): string[] | null {
  if (trimmed.startsWith(MODEL_SHOT_MODEL_MODE_PREFIX)) {
    return listModelShotModelModeChoiceMessages();
  }
  if (trimmed.startsWith(MODEL_SHOT_MODEL_CHOICE_PREFIX)) {
    return MODEL_SHOT_MODEL_ARCHETYPES.map((m) => `${MODEL_SHOT_MODEL_CHOICE_PREFIX}${m.label}`);
  }
  if (trimmed.startsWith(MODEL_SHOT_SCENE_MODE_PREFIX)) {
    return listModelShotSceneModeChoiceMessages();
  }
  if (trimmed.startsWith(MODEL_SHOT_SCENE_CHOICE_PREFIX)) {
    const pickList = listModelShotScenePickChoiceMessages(project.id);
    return pickList.includes(trimmed) ? pickList : [trimmed];
  }
  if (trimmed.startsWith(MODEL_SHOT_PROP_MODE_PREFIX)) {
    return listModelShotPropModeChoiceMessages();
  }
  if (trimmed.startsWith(MODEL_SHOT_STYLE_CHOICE_PREFIX)) {
    return MODEL_SHOT_STYLE_CHOICES.map((s) => `${MODEL_SHOT_STYLE_CHOICE_PREFIX}${s.label}`);
  }
  if (trimmed.startsWith(MODEL_SHOT_USAGE_CHOICE_PREFIX)) {
    return MODEL_SHOT_USAGE_CHOICES.map((u) => `${MODEL_SHOT_USAGE_CHOICE_PREFIX}${u.label}`);
  }
  if (trimmed.startsWith(MODEL_SHOT_COUNT_CHOICE_PREFIX)) {
    return MODEL_SHOT_COUNT_CHOICES.map((c) => `${MODEL_SHOT_COUNT_CHOICE_PREFIX}${c.label}`);
  }
  const poseLabel = posePlanGenerateChoiceLabel(project.brief?.poseCount ?? 6);
  if (trimmed === poseLabel || trimmed === "生成姿势方案" || trimmed === "重新生成姿势方案") {
    return [trimmed];
  }
  if (
    trimmed === "确认姿势计划" ||
    trimmed === "查看中栏姿势方案" ||
    trimmed === "微调某条 Prompt" ||
    trimmed.startsWith("微调·") ||
    trimmed.startsWith("微调 ") ||
    trimmed === "重新出图"
  ) {
    return [trimmed];
  }
  return null;
}

function historicalBlockTitle(trimmed: string): string {
  if (trimmed.startsWith(MODEL_SHOT_MODEL_MODE_PREFIX)) return "已选 · 模特方式";
  if (trimmed.startsWith(MODEL_SHOT_MODEL_CHOICE_PREFIX)) return "已选 · 虚拟模特";
  if (trimmed.startsWith(MODEL_SHOT_SCENE_MODE_PREFIX)) return "已选 · 场景方式";
  if (trimmed.startsWith(MODEL_SHOT_SCENE_CHOICE_PREFIX)) return "已选 · 场景词库";
  if (trimmed.startsWith(MODEL_SHOT_PROP_MODE_PREFIX)) return "已选 · 道具方式";
  if (trimmed.startsWith(MODEL_SHOT_STYLE_CHOICE_PREFIX)) return "已选 · 风格调性";
  if (trimmed.startsWith(MODEL_SHOT_USAGE_CHOICE_PREFIX)) return "已选 · 主要用途";
  if (trimmed.startsWith(MODEL_SHOT_COUNT_CHOICE_PREFIX)) return "已选 · 姿势张数";
  return "已选方案";
}

/** 用户点选消息 → 只读卡片组（含选中高亮），用于会话历史 */
export function buildModelShotHistoricalChoiceBlock(
  userMessage: string,
  project: ModelShotProject,
): ModelShotHistoricalChoiceBlock | null {
  const trimmed = userMessage.trim();
  if (!trimmed) return null;
  const group = resolveHistoricalChoiceMessages(trimmed, project);
  if (!group) return null;
  return {
    title: historicalBlockTitle(trimmed),
    selectedMessage: trimmed,
    cards: buildModelShotAssistantChoiceCards(project, group),
  };
}

export function isModelShotAssistantChoiceMessage(
  userMessage: string,
  project: ModelShotProject,
): boolean {
  return buildModelShotHistoricalChoiceBlock(userMessage, project) !== null;
}
