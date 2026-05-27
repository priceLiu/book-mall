import type { CanvasFlowNode } from "./types";
import {
  isLegacyStoryProDirectorPrompt,
  storyProHubDefaultPromptPack,
  STORY_PRO_PACK_PROMPT_VERSION,
} from "./story-pro-script-pack";
import {
  storyProThemeSystemPromptForTemplate,
  type StoryProThemeSystemPromptTemplateId,
} from "./story-pro-theme-templates";
import {
  STORY_LEGACY_OUTLINE_USER_MARK,
  STORY_PACK_PROMPT_VERSION,
  applyThemeToStorySystemPrompt,
  extractThemeFromStorySystemPrompt,
  isLegacyStoryPackSystemPrompt,
  storyHubDefaultPromptPack,
  storyThemeSystemPromptForTemplate,
  type StoryThemeSystemPromptTemplateId,
} from "./story-prompts";

const STORY_COMIC_STARTER = "story-comic-starter";
const STORY_SCRIPT_HUB = "story-script-hub";
const STORY_PRO_STARTER = "story-pro-starter";
const STORY_PRO_SCRIPT_HUB = "story-pro-script-hub";

function comicPromptPackVersion(data: Record<string, unknown>): number {
  const v = data.storyPackPromptVersion;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function proPromptPackVersion(data: Record<string, unknown>): number {
  const v = data.storyProPackPromptVersion;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function migrateStoryComicStarterData(
  data: Record<string, unknown>,
): Record<string, unknown> | null {
  const curVer = comicPromptPackVersion(data);
  const templateId = data.systemPromptTemplateId as
    | StoryThemeSystemPromptTemplateId
    | undefined;
  const systemPrompt = String(data.systemPrompt ?? "").trim();

  const shouldRefreshTemplate =
    Boolean(templateId) && isLegacyStoryPackSystemPrompt(systemPrompt);

  const needsVersionBump = curVer < STORY_PACK_PROMPT_VERSION;
  if (!needsVersionBump && !shouldRefreshTemplate) {
    return null;
  }

  const next: Record<string, unknown> = {
    ...data,
    storyPackPromptVersion: STORY_PACK_PROMPT_VERSION,
  };

  if (shouldRefreshTemplate && templateId) {
    const theme = extractThemeFromStorySystemPrompt(systemPrompt);
    next.systemPrompt = applyThemeToStorySystemPrompt(
      storyThemeSystemPromptForTemplate(templateId),
      theme,
    );
  }

  return next;
}

function migrateStoryProStarterData(
  data: Record<string, unknown>,
): Record<string, unknown> | null {
  const curVer = proPromptPackVersion(data);
  const templateId = (data.systemPromptTemplateId ??
    "director-from-script") as StoryProThemeSystemPromptTemplateId;
  const systemPrompt = String(data.systemPrompt ?? "").trim();

  const shouldRefreshTemplate =
    templateId === "director-from-script" &&
    isLegacyStoryProDirectorPrompt(systemPrompt);

  const needsVersionBump = curVer < STORY_PRO_PACK_PROMPT_VERSION;
  if (!needsVersionBump && !shouldRefreshTemplate) {
    return null;
  }

  const next: Record<string, unknown> = {
    ...data,
    storyProPackPromptVersion: STORY_PRO_PACK_PROMPT_VERSION,
  };

  if (shouldRefreshTemplate) {
    next.systemPrompt = storyProThemeSystemPromptForTemplate(
      "director-from-script",
    );
    next.systemPromptTemplateId = "director-from-script";
  }

  return next;
}

function migrateStoryScriptHubData(
  data: Record<string, unknown>,
  starterSystemPrompt?: string,
): Record<string, unknown> | null {
  const curVer = comicPromptPackVersion(data);
  const promptOutline = String(data.promptOutline ?? "");
  const legacyOutline = promptOutline.includes(STORY_LEGACY_OUTLINE_USER_MARK);
  const needsHubPrompts =
    curVer < STORY_PACK_PROMPT_VERSION || legacyOutline;

  if (!needsHubPrompts && curVer >= STORY_PACK_PROMPT_VERSION) {
    return null;
  }

  const defaults = storyHubDefaultPromptPack();
  const next: Record<string, unknown> = {
    ...data,
    ...defaults,
    storyPackPromptVersion: STORY_PACK_PROMPT_VERSION,
  };
  if (starterSystemPrompt?.trim()) {
    next.outlineSystemPrompt = starterSystemPrompt.trim();
  }
  return next;
}

function migrateStoryProScriptHubData(
  data: Record<string, unknown>,
  starterSystemPrompt?: string,
): Record<string, unknown> | null {
  const curVer = proPromptPackVersion(data);
  const promptOutline = String(data.promptOutline ?? "");
  const legacyHub =
    !promptOutline.includes("【制作包硬性约束") ||
    !promptOutline.includes("角色视觉辞典");
  const needsHubPrompts =
    curVer < STORY_PRO_PACK_PROMPT_VERSION || legacyHub;

  if (!needsHubPrompts && curVer >= STORY_PRO_PACK_PROMPT_VERSION) {
    return null;
  }

  const defaults = storyProHubDefaultPromptPack();
  const next: Record<string, unknown> = {
    ...data,
    ...defaults,
    storyProPackPromptVersion: STORY_PRO_PACK_PROMPT_VERSION,
  };
  if (starterSystemPrompt?.trim()) {
    next.outlineSystemPrompt = starterSystemPrompt.trim();
  }
  return next;
}

/** 加载画布：刷新内置制作包模板 + hub 段 prompt */
export function migrateStoryPromptPackNode(n: CanvasFlowNode): CanvasFlowNode {
  const data = { ...((n.data ?? {}) as Record<string, unknown>) };
  let patch: Record<string, unknown> | null = null;
  if (n.type === STORY_COMIC_STARTER) {
    patch = migrateStoryComicStarterData(data);
  } else if (n.type === STORY_PRO_STARTER) {
    patch = migrateStoryProStarterData(data);
  } else if (n.type === STORY_SCRIPT_HUB) {
    patch = migrateStoryScriptHubData(data);
  } else if (n.type === STORY_PRO_SCRIPT_HUB) {
    patch = migrateStoryProScriptHubData(data);
  }
  if (!patch) return n;
  return { ...n, data: patch };
}

export function migrateStoryPromptPackAll(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const comicStarterSystemByHubId = new Map<string, string>();
  const proStarterSystemByHubId = new Map<string, string>();

  for (const n of nodes) {
    const ws = (n.data as { workspaceIds?: { scriptHubId?: string } })
      ?.workspaceIds;
    const hubId = ws?.scriptHubId?.trim();
    if (!hubId) continue;
    if (n.type === STORY_COMIC_STARTER) {
      const patch = migrateStoryComicStarterData(
        (n.data ?? {}) as Record<string, unknown>,
      );
      const systemPrompt = String(
        patch?.systemPrompt ??
          (n.data as { systemPrompt?: string }).systemPrompt ??
          "",
      ).trim();
      if (systemPrompt) comicStarterSystemByHubId.set(hubId, systemPrompt);
    }
    if (n.type === STORY_PRO_STARTER) {
      const patch = migrateStoryProStarterData(
        (n.data ?? {}) as Record<string, unknown>,
      );
      const systemPrompt = String(
        patch?.systemPrompt ??
          (n.data as { systemPrompt?: string }).systemPrompt ??
          "",
      ).trim();
      if (systemPrompt) proStarterSystemByHubId.set(hubId, systemPrompt);
    }
  }

  return nodes.map((n) => {
    if (n.type === STORY_COMIC_STARTER) {
      const patch = migrateStoryComicStarterData(
        (n.data ?? {}) as Record<string, unknown>,
      );
      if (!patch) return n;
      return { ...n, data: patch };
    }
    if (n.type === STORY_PRO_STARTER) {
      const patch = migrateStoryProStarterData(
        (n.data ?? {}) as Record<string, unknown>,
      );
      if (!patch) return n;
      return { ...n, data: patch };
    }
    if (n.type === STORY_SCRIPT_HUB) {
      const patch = migrateStoryScriptHubData(
        (n.data ?? {}) as Record<string, unknown>,
        comicStarterSystemByHubId.get(n.id),
      );
      if (!patch) return n;
      return { ...n, data: patch };
    }
    if (n.type === STORY_PRO_SCRIPT_HUB) {
      const patch = migrateStoryProScriptHubData(
        (n.data ?? {}) as Record<string, unknown>,
        proStarterSystemByHubId.get(n.id),
      );
      if (!patch) return n;
      return { ...n, data: patch };
    }
    return n;
  });
}
