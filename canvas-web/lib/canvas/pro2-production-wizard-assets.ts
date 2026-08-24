import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import type {
  Pro2ProductionScript,
} from "@/lib/canvas/data/pro2-production-script-schema";

type Pro2ScriptCharacter = NonNullable<Pro2ProductionScript["characters"]>[number];
type Pro2ScriptScene = NonNullable<Pro2ProductionScript["scenes"]>[number];
type Pro2ScriptProp = NonNullable<Pro2ProductionScript["props"]>[number];
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { storyRefMentionToken } from "@/lib/canvas/story-ref-image";
import { resolvePropIdsFromDisplayText, reconcileShotEntityLinks } from "@/lib/canvas/pro2-shot-entity-reconcile";

export type Pro2WizardAssetKind = "character" | "scene" | "prop";

export type Pro2ProductionWizardAssetDraft = {
  kind: Pro2WizardAssetKind;
  assetId: string;
  prompt?: string;
  refImages?: StoryRefImage[];
  providerId?: string;
  modelKey?: string;
  params?: Record<string, unknown>;
  /** 出图结果占位 / OSS URL */
  previewUrl?: string;
  /** 后台出图中（弹窗关闭后轮询任务） */
  generateStatus?: "idle" | "running" | "failed";
  taskId?: string;
  failMessage?: string;
};

export type Pro2WizardLinkedEntity = {
  kind: Pro2WizardAssetKind;
  id: string;
  name: string;
};

export type Pro2WizardTextSegment =
  | { type: "text"; value: string }
  | { type: "entity"; value: string; entity: Pro2WizardLinkedEntity };

export function wizardAssetDraftKey(
  kind: Pro2WizardAssetKind,
  assetId: string,
): string {
  return `${kind}:${assetId}`;
}

export function parseWizardAssetDraftKey(key: string): {
  kind: Pro2WizardAssetKind;
  assetId: string;
} | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const kind = key.slice(0, idx) as Pro2WizardAssetKind;
  if (kind !== "character" && kind !== "scene" && kind !== "prop") return null;
  const assetId = key.slice(idx + 1).trim();
  if (!assetId) return null;
  return { kind, assetId };
}

export function defaultWizardAssetPrompt(
  kind: Pro2WizardAssetKind,
  asset: {
    name: string;
    imagePrompt?: string;
    description?: string;
  },
): string {
  const base =
    asset.imagePrompt?.trim() ||
    asset.description?.trim() ||
    asset.name.trim();
  return base;
}

function entityFromCharacter(c: Pro2ScriptCharacter): Pro2WizardLinkedEntity {
  return { kind: "character", id: c.id, name: c.name };
}

function entityFromScene(s: Pro2ScriptScene): Pro2WizardLinkedEntity {
  return { kind: "scene", id: s.id, name: s.name };
}

function entityFromProp(p: Pro2ScriptProp): Pro2WizardLinkedEntity {
  return { kind: "prop", id: p.id, name: p.name };
}

/** 分镜 · 关联本镜出现的角色 / 场景 / 道具（ID 优先，正文补全） */
export function resolveShotLinkedEntities(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): Pro2WizardLinkedEntity[] {
  const characters = script.characters ?? [];
  const scenes = script.scenes ?? [];
  const props = script.props ?? [];
  const byId = new Map<string, Pro2WizardLinkedEntity>();

  for (const id of shot.characterIds ?? []) {
    const hit = characters.find((c) => c.id === id);
    if (hit) byId.set(wizardAssetDraftKey("character", hit.id), entityFromCharacter(hit));
  }
  if (shot.sceneId) {
    const hit = scenes.find((s) => s.id === shot.sceneId);
    if (hit) byId.set(wizardAssetDraftKey("scene", hit.id), entityFromScene(hit));
  }
  for (const id of shot.propIds ?? []) {
    const hit = props.find((p) => p.id === id);
    if (hit) byId.set(wizardAssetDraftKey("prop", hit.id), entityFromProp(hit));
  }

  const text = [
    shot.sceneDescription ?? "",
    shot.dialogue ?? "",
    shot.sfxNote ?? "",
    shot.audioNote ?? "",
    shot.lighting ?? "",
    shot.cameraMove ?? "",
    resolveShotPropNamesFromScript(shot, script),
  ].join("\n");

  const nameCandidates: Pro2WizardLinkedEntity[] = [
    ...characters.map(entityFromCharacter),
    ...scenes.map(entityFromScene),
    ...props.map(entityFromProp),
  ].sort((a, b) => b.name.length - a.name.length);

  for (const entity of nameCandidates) {
    const key = wizardAssetDraftKey(entity.kind, entity.id);
    if (byId.has(key)) continue;
    if (textIncludesEntityTerm(text, entity.name)) {
      byId.set(key, entity);
      continue;
    }
    if (entity.kind === "prop") {
      const prop = props.find((p) => p.id === entity.id);
      if (prop?.description && textIncludesEntityTerm(text, prop.description)) {
        byId.set(key, entity);
        continue;
      }
    }
    const alias = longestEntityAliasInText(entity.name, text);
    if (alias) byId.set(key, entity);
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

export type Pro2ProductionScriptShot = NonNullable<
  Pro2ProductionScript["shots"]
>[number];

function resolveShotPropNamesFromScript(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): string {
  const props = script.props ?? [];
  const names =
    shot.propIds
      ?.map((id) => props.find((p) => p.id === id)?.name)
      .filter(Boolean) ?? [];
  return names.length ? names.join("、") : "";
}

function textIncludesEntityTerm(text: string, term: string): boolean {
  const t = term.trim();
  return t.length >= 2 && text.includes(t);
}

/** 资产全名未出现时，取在正文里能匹配的最长子串（如 盛唐金銮殿 → 金銮殿） */
export function longestEntityAliasInText(
  entityName: string,
  corpus: string,
): string | null {
  const name = entityName.trim();
  if (!name || !corpus) return null;
  if (corpus.includes(name)) return name;
  for (let len = name.length - 1; len >= 2; len--) {
    for (let start = 0; start <= name.length - len; start++) {
      const sub = name.slice(start, start + len);
      if (corpus.includes(sub)) return sub;
    }
  }
  return null;
}

export function buildScriptEntityCatalog(
  script: Pro2ProductionScript,
): Pro2WizardLinkedEntity[] {
  return [
    ...(script.characters ?? []).map(entityFromCharacter),
    ...(script.scenes ?? []).map(entityFromScene),
    ...(script.props ?? []).map(entityFromProp),
  ];
}

export function buildScriptTextCorpus(script: Pro2ProductionScript): string {
  const parts: string[] = [];
  for (const shot of script.shots ?? []) {
    parts.push(
      shot.sceneDescription ?? "",
      shot.dialogue ?? "",
      shot.sfxNote ?? "",
      shot.audioNote ?? "",
      shot.lighting ?? "",
      shot.cameraMove ?? "",
      resolveShotPropNamesFromScript(shot, script),
    );
  }
  return parts.join("\n");
}

export type EntityHighlightMatcher = {
  term: string;
  entity: Pro2WizardLinkedEntity;
};

/** 分镜高亮 · 角色 / 场景 / 道具全量匹配词（含别名） */
export function buildEntityHighlightMatchers(
  script: Pro2ProductionScript,
): EntityHighlightMatcher[] {
  const corpus = buildScriptTextCorpus(script);
  const seen = new Set<string>();
  const matchers: EntityHighlightMatcher[] = [];

  const push = (term: string, entity: Pro2WizardLinkedEntity) => {
    const t = term.trim();
    if (t.length < 2) return;
    const key = `${entity.kind}:${entity.id}:${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    matchers.push({ term: t, entity });
  };

  for (const entity of buildScriptEntityCatalog(script)) {
    push(entity.name, entity);
    for (const part of entity.name.split(/[·•／/|、，,]/)) {
      push(part, entity);
    }
    if (entity.kind === "prop") {
      const prop = script.props?.find((p) => p.id === entity.id);
      for (const part of (prop?.description ?? "").split(/[、，,；;]/)) {
        push(part, entity);
      }
    }
    const alias = longestEntityAliasInText(entity.name, corpus);
    if (alias && alias !== entity.name) push(alias, entity);
  }

  return matchers.sort((a, b) => b.term.length - a.term.length);
}

/** 画面描述 · 将关联实体名高亮为绿色片段 */
export function splitTextByEntityMatchers(
  text: string,
  matchers: EntityHighlightMatcher[],
): Pro2WizardTextSegment[] {
  if (!text.trim() || !matchers.length) {
    return [{ type: "text", value: text }];
  }
  const names = matchers;

  const segments: Pro2WizardTextSegment[] = [];
  let i = 0;
  while (i < text.length) {
    let matched: EntityHighlightMatcher | null = null;
    for (const cand of names) {
      if (text.startsWith(cand.term, i)) {
        matched = cand;
        break;
      }
    }
    if (matched) {
      segments.push({
        type: "entity",
        value: matched.term,
        entity: matched.entity,
      });
      i += matched.term.length;
      continue;
    }
    const nextBreak = names.reduce((min, cand) => {
      const pos = text.indexOf(cand.term, i);
      if (pos < 0) return min;
      return min < 0 ? pos : Math.min(min, pos);
    }, -1);
    const end = nextBreak < 0 ? text.length : nextBreak;
    if (end > i) {
      segments.push({ type: "text", value: text.slice(i, end) });
    }
    i = end > i ? end : i + 1;
  }
  return segments.length ? segments : [{ type: "text", value: text }];
}

/** @deprecated 使用 splitTextByEntityMatchers + buildEntityHighlightMatchers */
export function splitTextByLinkedEntities(
  text: string,
  entities: Pro2WizardLinkedEntity[],
): Pro2WizardTextSegment[] {
  return splitTextByEntityMatchers(
    text,
    entities.map((entity) => ({ term: entity.name, entity })),
  );
}

export function entityHighlightClass(_kind: Pro2WizardAssetKind): string {
  return "font-medium text-emerald-400";
}

export function buildWizardAssetMentionables(
  script: Pro2ProductionScript | undefined,
  refImages: StoryRefImage[],
  exclude?: { kind: Pro2WizardAssetKind; assetId: string },
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>,
): MentionableItem[] {
  const previewFor = (kind: Pro2WizardAssetKind, assetId: string) => {
    const url = assetDrafts?.[wizardAssetDraftKey(kind, assetId)]?.previewUrl?.trim();
    return url && /^https?:\/\//i.test(url) ? url : undefined;
  };

  const items: MentionableItem[] = [];
  for (const c of script?.characters ?? []) {
    if (exclude?.kind === "character" && exclude.assetId === c.id) continue;
    items.push({
      id: `wiz-char-${c.id}`,
      label: `角色 · ${c.name}`,
      kind: "character",
      previewUrl: previewFor("character", c.id),
    });
  }
  for (const s of script?.scenes ?? []) {
    if (exclude?.kind === "scene" && exclude.assetId === s.id) continue;
    items.push({
      id: `wiz-scene-${s.id}`,
      label: `场景 · ${s.name}`,
      kind: "scene",
      previewUrl: previewFor("scene", s.id),
    });
  }
  for (const p of script?.props ?? []) {
    if (exclude?.kind === "prop" && exclude.assetId === p.id) continue;
    items.push({
      id: `wiz-prop-${p.id}`,
      label: `道具 · ${p.name}`,
      kind: "prop",
      previewUrl: previewFor("prop", p.id),
    });
  }
  for (const ref of refImages) {
    items.push({
      id: ref.id,
      label: ref.label,
      kind: "image",
      previewUrl: ref.url,
      gridSplitCrop: ref.gridSplitCrop,
    });
  }
  return items;
}

export function appendRefMentionToPrompt(
  prompt: string,
  refId: string,
): string {
  const token = storyRefMentionToken(refId);
  if (prompt.includes(token)) return prompt;
  const trimmed = prompt.trimEnd();
  return trimmed ? `${trimmed} ${token}` : token;
}

/** 分镜表 · 道具列文案 → propIds（fuzzy · 见 pro2-shot-entity-reconcile） */
export function propIdsFromDisplayNames(
  script: Pro2ProductionScript,
  text: string,
): string[] {
  return resolvePropIdsFromDisplayText(text, script);
}

export function patchProductionScriptShot(
  script: Pro2ProductionScript,
  shotIndex: number,
  patch: Partial<Pro2ProductionScriptShot>,
): Pro2ProductionScript {
  const shots = script.shots ?? [];
  return {
    ...script,
    shots: shots.map((s) => {
      if (s.index !== shotIndex) return s;
      const merged = { ...s, ...patch };
      return reconcileShotEntityLinks(merged, {
        ...script,
        shots: shots.map((x) => (x.index === shotIndex ? merged : x)),
      });
    }),
  };
}

export const WIZARD_ASSET_KIND_LABEL: Record<Pro2WizardAssetKind, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

export const WIZARD_ASSET_PLACEHOLDER: Record<Pro2WizardAssetKind, string> = {
  character: "生成或上传角色图",
  scene: "生成或上传场景图",
  prop: "生成或上传道具图",
};

export function newWizardAssetId(kind: Pro2WizardAssetKind): string {
  const prefix =
    kind === "character" ? "char" : kind === "scene" ? "scene" : "prop";
  return `wiz-${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function createWizardCharacterEntry(
  name: string,
  id: string,
): Pro2ScriptCharacter {
  return {
    id,
    name,
    role: "待补充",
    appearance: "待补充",
    personality: "",
    imagePrompt: `名称：${name}\n描述：待补充`,
  };
}

function createWizardSceneEntry(name: string, id: string): Pro2ScriptScene {
  return {
    id,
    name,
    environmentTimeMood: "待补充",
    imagePrompt: `名称：${name}\n描述：待补充`,
    negativePrompt: "",
  };
}

function createWizardPropEntry(name: string, id: string): Pro2ScriptProp {
  return {
    id,
    name,
    description: "待补充",
    imagePrompt: `名称：${name}\n描述：待补充`,
  };
}

/** 向导 · 新增角色 / 场景 / 道具条目 */
export function appendWizardAsset(
  script: Pro2ProductionScript,
  kind: Pro2WizardAssetKind,
  name: string,
): Pro2ProductionScript {
  const trimmed = name.trim();
  if (!trimmed) return script;
  const id = newWizardAssetId(kind);
  if (kind === "character") {
    return {
      ...script,
      characters: [
        ...(script.characters ?? []),
        createWizardCharacterEntry(trimmed, id),
      ],
    };
  }
  if (kind === "scene") {
    return {
      ...script,
      scenes: [...(script.scenes ?? []), createWizardSceneEntry(trimmed, id)],
    };
  }
  return {
    ...script,
    props: [...(script.props ?? []), createWizardPropEntry(trimmed, id)],
  };
}
