/**
 * Pro2 分镜 · 角色/场景/道具实体关联 reconcile
 * book-mall/lib/canvas/pro2-shot-entity-reconcile.ts 须保持同步
 */
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import { resolvePro2ShotFrameImagePrompt } from "@/lib/canvas/data/pro2-production-script-schema";
import { parseReferencedIds } from "@/lib/canvas/dock-mention-parse";
import {
  pro2PlaceholderSlug,
  stripPro2AnchorPlaceholders,
} from "@/lib/canvas/pro2-chinese-prompt-normalize";
import {
  longestEntityAliasInText,
  type EntityHighlightMatcher,
  type Pro2ProductionScriptShot,
  type Pro2WizardLinkedEntity,
  wizardAssetDraftKey,
} from "@/lib/canvas/pro2-production-wizard-assets";

export type WizardMentionAssetRefs = {
  characterIds: string[];
  sceneIds: string[];
  propIds: string[];
};

const WIZ_CHAR_PREFIX = "wiz-char-";
const WIZ_SCENE_PREFIX = "wiz-scene-";
const WIZ_PROP_PREFIX = "wiz-prop-";

const STORE_TOKEN_RE = /@<([^>\s]+)>/g;

const DIALOGUE_SPEAKER_RE = /^([^（(：:\n]+)[（(]/u;

type TextRange = { start: number; end: number };

function existingMentionRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  STORE_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STORE_TOKEN_RE.exec(text)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return ranges;
}

function rangeCovers(ranges: TextRange[], start: number, len: number): boolean {
  const end = start + len;
  return ranges.some((r) => start >= r.start && end <= r.end);
}

function pointInMention(ranges: TextRange[], pos: number): boolean {
  return ranges.some((r) => pos >= r.start && pos < r.end);
}

type HydrationTerm = { term: string; entity: Pro2WizardLinkedEntity };

function buildHydrationTerms(
  entities: Pro2WizardLinkedEntity[],
  fieldText: string,
): HydrationTerm[] {
  const terms: HydrationTerm[] = [];
  const seen = new Set<string>();
  const push = (term: string, entity: Pro2WizardLinkedEntity) => {
    const t = term.trim();
    if (t.length < 2 || !fieldText.includes(t)) return;
    const key = `${entity.kind}:${entity.id}:${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    terms.push({ term: t, entity });
  };

  for (const entity of entities) {
    push(entity.name, entity);
    for (const part of entity.name.split(/[·•／/|、，,]/)) {
      push(part, entity);
    }
    const alias = longestEntityAliasInText(entity.name, fieldText);
    if (alias) push(alias, entity);
  }

  return terms.sort((a, b) => b.term.length - a.term.length);
}

/** 正文纯文本 → @<wiz-*> token（编辑弹层打开时自动关联） */
export function hydrateWizardMentionsInText(
  text: string,
  entities: Pro2WizardLinkedEntity[],
): string {
  if (!text.trim() || !entities.length) return text;
  const protectedRanges = existingMentionRanges(text);
  const terms = buildHydrationTerms(entities, text);
  if (!terms.length) return text;

  let out = "";
  let i = 0;
  while (i < text.length) {
    if (pointInMention(protectedRanges, i)) {
      const range = protectedRanges.find((r) => i >= r.start && i < r.end)!;
      out += text.slice(range.start, range.end);
      i = range.end;
      continue;
    }

    let matched: HydrationTerm | null = null;
    for (const cand of terms) {
      if (
        text.startsWith(cand.term, i) &&
        !rangeCovers(protectedRanges, i, cand.term.length)
      ) {
        matched = cand;
        break;
      }
    }

    if (matched) {
      out += `@<${wizardMentionId(matched.entity.kind, matched.entity.id)}>`;
      i += matched.term.length;
      continue;
    }

    out += text[i]!;
    i += 1;
  }
  return out;
}

function uniq(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function textIncludesEntityTerm(text: string, term: string): boolean {
  const t = term.trim();
  return t.length >= 2 && text.includes(t);
}

/** 从 narrative 字段解析 @<wiz-char/scene/prop-{id}> */
export function parseWizardMentionAssetRefs(text: string): WizardMentionAssetRefs {
  const characterIds: string[] = [];
  const sceneIds: string[] = [];
  const propIds: string[] = [];
  for (const refId of parseReferencedIds(text)) {
    if (refId.startsWith(WIZ_CHAR_PREFIX)) {
      characterIds.push(refId.slice(WIZ_CHAR_PREFIX.length));
    } else if (refId.startsWith(WIZ_SCENE_PREFIX)) {
      sceneIds.push(refId.slice(WIZ_SCENE_PREFIX.length));
    } else if (refId.startsWith(WIZ_PROP_PREFIX)) {
      propIds.push(refId.slice(WIZ_PROP_PREFIX.length));
    }
  }
  return {
    characterIds: uniq(characterIds),
    sceneIds: uniq(sceneIds),
    propIds: uniq(propIds),
  };
}

/** 聚合本镜 narrative 文本（不含 audioNote） */
export function collectShotNarrativeText(shot: Pro2ProductionScriptShot): string {
  return [
    shot.sceneDescription ?? "",
    shot.lighting ?? "",
    shot.cameraMove ?? "",
    shot.dialogue ?? "",
    shot.sfxNote ?? "",
  ].join("\n");
}

/** 实体关联语料：Pass1 导演表 + Pass2 分镜图/视频提示词 */
export function collectShotEntityCorpusText(
  shot: Pro2ProductionScriptShot,
): string {
  return [
    collectShotNarrativeText(shot),
    resolvePro2ShotFrameImagePrompt(shot) ?? "",
    shot.videoPrompt ?? "",
  ].join("\n");
}

function resolvePropIdFromRawName(
  name: string,
  script: Pro2ProductionScript,
): string | undefined {
  const raw = name.trim();
  if (!raw || raw === "—") return undefined;
  const stripped = stripPro2AnchorPlaceholders(raw);
  const slug = pro2PlaceholderSlug(raw);
  const hit = script.props?.find(
    (p) =>
      p.id === raw ||
      p.id === slug ||
      p.id === raw.replace(/_/g, "-") ||
      p.name === raw ||
      p.name === stripped,
  );
  if (hit) return hit.id;
  if (/^prop[-_]/i.test(slug) || raw.includes("<<<prop_")) return slug;
  return undefined;
}

/** 道具列 / 顿号分隔文案 → propIds（fuzzy） */
export function resolvePropIdsFromDisplayText(
  text: string,
  script: Pro2ProductionScript,
): string[] {
  const t = text.trim();
  if (!t || t === "—") return [];
  const parts = t.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [];
  return uniq(
    parts
      .map((name) => resolvePropIdFromRawName(name, script))
      .filter((id): id is string => Boolean(id)),
  );
}

/** 对白说话人 → characterIds */
export function inferCharacterIdsFromDialogue(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): string[] {
  const dialogue = shot.dialogue?.trim() ?? "";
  if (!dialogue || dialogue === "—") return [];
  const characters = script.characters ?? [];
  const ids: string[] = [];
  for (const line of dialogue.split(/\n/u)) {
    const t = line.trim();
    if (!t || t === "—") continue;
    const m = t.match(DIALOGUE_SPEAKER_RE);
    const speaker = (m?.[1] ?? "").trim();
    if (!speaker) continue;
    const hit = characters.find(
      (c) =>
        c.name === speaker ||
        speaker.includes(c.name) ||
        c.name.includes(speaker),
    );
    if (hit) ids.push(hit.id);
  }
  return uniq(ids);
}

/** 场景名 fuzzy 别名最短长度（避免「现代」「盛唐」误绑） */
const SCENE_NAME_MIN_ALIAS = 4;

function scoreSceneAgainstText(
  scene: {
    id: string;
    name: string;
    environmentTimeMood?: string;
    description?: string;
  },
  text: string,
): number {
  let score = 0;
  const name = scene.name.trim();
  if (name.length >= 2) {
    if (textIncludesEntityTerm(text, name)) {
      score += name.length * 10;
    } else {
      const alias = longestEntityAliasInText(name, text);
      const minAlias = Math.min(SCENE_NAME_MIN_ALIAS, name.length);
      if (alias && alias.length >= minAlias) score += alias.length * 5;
    }
  }
  const mood = scene.environmentTimeMood?.trim();
  if (mood) {
    if (textIncludesEntityTerm(text, mood)) score += mood.length * 8;
    else {
      const moodAlias = longestEntityAliasInText(mood, text);
      if (moodAlias && moodAlias.length >= 4) score += moodAlias.length * 4;
    }
    for (const token of mood.split(/[,，、]/).map((t) => t.trim()).filter(Boolean)) {
      if (token.length >= 2 && textIncludesEntityTerm(text, token)) {
        score += token.length * 3;
      }
    }
  }
  const desc = scene.description?.trim();
  if (desc && desc.length >= 4) {
    if (textIncludesEntityTerm(text, desc)) score += desc.length * 6;
    else {
      const alias = longestEntityAliasInText(desc, text);
      if (alias && alias.length >= 4) score += alias.length * 3;
    }
  }
  return score;
}

/** 本镜 narrative → 最佳 sceneId（按匹配得分，单镜单场景） */
export function inferBestSceneIdFromNarrative(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): string | undefined {
  const text = collectShotEntityCorpusText(shot);
  const scenes = script.scenes ?? [];
  let best: { id: string; score: number } | undefined;
  for (const scene of scenes) {
    const score = scoreSceneAgainstText(scene, text);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { id: scene.id, score };
  }
  return best?.id;
}

/** 本镜正文 infer 实体 ID（仅本镜 corpus，不用全局 description 拆词） */
export function inferEntityIdsFromNarrative(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): WizardMentionAssetRefs {
  const text = collectShotEntityCorpusText(shot);
  const characters = script.characters ?? [];
  const props = script.props ?? [];

  const characterIds: string[] = [];
  const propIds: string[] = [];

  const candidates: Pro2WizardLinkedEntity[] = [
    ...characters.map((c) => ({ kind: "character" as const, id: c.id, name: c.name })),
    ...props.map((p) => ({ kind: "prop" as const, id: p.id, name: p.name })),
  ].sort((a, b) => b.name.length - a.name.length);

  for (const entity of candidates) {
    const matched =
      textIncludesEntityTerm(text, entity.name) ||
      Boolean(longestEntityAliasInText(entity.name, text));
    if (!matched) continue;
    if (entity.kind === "character") characterIds.push(entity.id);
    else propIds.push(entity.id);
  }

  const bestSceneId = inferBestSceneIdFromNarrative(shot, script);

  return {
    characterIds: uniq(characterIds),
    sceneIds: bestSceneId ? [bestSceneId] : [],
    propIds: uniq(propIds),
  };
}

function normalizePropIdsAgainstCatalog(
  propIds: string[] | undefined,
  script: Pro2ProductionScript,
): string[] {
  if (!propIds?.length) return [];
  const props = script.props ?? [];
  return uniq(
    propIds
      .map((id) => {
        const raw = String(id).trim();
        if (!raw) return "";
        const slug = pro2PlaceholderSlug(raw);
        const byId = props.find(
          (p) =>
            p.id === raw || p.id === slug || p.id === raw.replace(/_/g, "-"),
        );
        if (byId) return byId.id;
        const stripped = stripPro2AnchorPlaceholders(raw);
        const byName = props.find((p) => p.name === raw || p.name === stripped);
        if (byName) return byName.id;
        return slug;
      })
      .filter(Boolean),
  );
}

function pickSceneId(
  existing: string | undefined,
  mentionSceneIds: string[],
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): string | undefined {
  const scenes = script.scenes ?? [];
  if (existing) {
    const hit = scenes.find((s) => s.id === existing);
    if (hit) return existing;
  }
  for (const id of mentionSceneIds) {
    const hit = scenes.find((s) => s.id === id);
    if (hit) return hit.id;
  }
  return inferBestSceneIdFromNarrative(shot, script);
}

export type ReconcileShotEntityOptions = {
  /** 道具列显式文案（编辑弹层） */
  propDisplayText?: string;
};

/** 合并本镜 entity links：已有 ID > @ > 道具列 > 正文 infer > 对白 */
export function reconcileShotEntityLinks(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
  options?: ReconcileShotEntityOptions,
): Pro2ProductionScriptShot {
  const corpus = collectShotEntityCorpusText(shot);
  const fromMentions = parseWizardMentionAssetRefs(corpus);
  const fromInfer = inferEntityIdsFromNarrative(shot, script);
  const fromDialogue = inferCharacterIdsFromDialogue(shot, script);
  const fromPropDisplay = options?.propDisplayText
    ? resolvePropIdsFromDisplayText(options.propDisplayText, script)
    : [];

  const characterIds = uniq([
    ...(shot.characterIds ?? []),
    ...fromMentions.characterIds,
    ...fromDialogue,
    ...fromInfer.characterIds,
  ]);

  const sceneId = pickSceneId(
    shot.sceneId,
    fromMentions.sceneIds,
    shot,
    script,
  );

  const propIds = normalizePropIdsAgainstCatalog(
    uniq([
      ...(shot.propIds ?? []),
      ...fromMentions.propIds,
      ...fromPropDisplay,
      ...fromInfer.propIds,
    ]),
    script,
  );

  return {
    ...shot,
    characterIds: characterIds.length ? characterIds : undefined,
    sceneId,
    propIds: propIds.length ? propIds : undefined,
  };
}

/** 全部分镜 reconcile */
export function reconcileProductionScriptEntityLinks(
  script: Pro2ProductionScript,
): Pro2ProductionScript {
  const shots = script.shots ?? [];
  if (!shots.length) return script;
  const reconciled = shots.map((s) => reconcileShotEntityLinks(s, script));
  const changed = reconciled.some((s, i) => {
    const orig = shots[i];
    return (
      s.sceneId !== orig.sceneId ||
      JSON.stringify(s.propIds ?? []) !== JSON.stringify(orig.propIds ?? []) ||
      JSON.stringify(s.characterIds ?? []) !==
        JSON.stringify(orig.characterIds ?? [])
    );
  });
  if (!changed) return script;
  return { ...script, shots: reconciled };
}

/** sceneId → 场景名（UI / MD · 展示前先 reconcile） */
export function resolveShotSceneName(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): string {
  const effective = reconcileShotEntityLinks(shot, script);
  if (!effective.sceneId) return "";
  const hit = script.scenes?.find((s) => s.id === effective.sceneId);
  return hit?.name?.trim() ?? "";
}

function linkedEntitiesFromReconciledShot(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): Pro2WizardLinkedEntity[] {
  const characters = script.characters ?? [];
  const scenes = script.scenes ?? [];
  const props = script.props ?? [];
  const out: Pro2WizardLinkedEntity[] = [];

  for (const id of shot.characterIds ?? []) {
    const c = characters.find((x) => x.id === id);
    if (c) out.push({ kind: "character", id: c.id, name: c.name });
  }
  if (shot.sceneId) {
    const s = scenes.find((x) => x.id === shot.sceneId);
    if (s) out.push({ kind: "scene", id: s.id, name: s.name });
  }
  for (const id of shot.propIds ?? []) {
    const p = props.find((x) => x.id === id);
    if (p) out.push({ kind: "prop", id: p.id, name: p.name });
  }
  return out;
}

/** 本镜高亮 matchers（仅 reconcile 后的关联实体 + 本镜 corpus 别名） */
export function buildEntityHighlightMatchersForShot(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): EntityHighlightMatcher[] {
  const reconciled = reconcileShotEntityLinks(shot, script);
  const corpus = collectShotEntityCorpusText(reconciled);
  const linked = linkedEntitiesFromReconciledShot(reconciled, script);
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

  for (const entity of linked) {
    push(entity.name, entity);
    for (const part of entity.name.split(/[·•／/|、，,]/)) {
      push(part, entity);
    }
    const alias = longestEntityAliasInText(entity.name, corpus);
    if (alias && alias !== entity.name) push(alias, entity);
  }

  return matchers.sort((a, b) => b.term.length - a.term.length);
}

function assetSummaryForPrompt(
  kind: Pro2WizardLinkedEntity["kind"],
  id: string,
  script: Pro2ProductionScript,
): string {
  if (kind === "character") {
    const c = script.characters?.find((x) => x.id === id);
    if (!c) return id;
    const parts = [
      c.name,
      c.description?.trim(),
      c.clothing?.trim(),
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (kind === "scene") {
    const s = script.scenes?.find((x) => x.id === id);
    if (!s) return id;
    const parts = [s.name, s.environmentTimeMood?.trim()].filter(Boolean);
    return parts.join(" · ");
  }
  const p = script.props?.find((x) => x.id === id);
  if (!p) return id;
  const parts = [p.name, p.description?.trim()].filter(Boolean);
  return parts.join(" · ");
}

/** Pass2 · 将 @<wiz-*> 展开为资产辞典摘要 */
/** 分镜表展示 · @<wiz-*> → 实体 canonical 名（保留绿色高亮） */
export function formatWizardMentionsForDisplay(
  text: string,
  script: Pro2ProductionScript,
): string {
  if (!text.trim() || !text.includes("@<")) return text;
  let out = text;
  for (const refId of parseReferencedIds(text)) {
    const token = `@<${refId}>`;
    let label = token;
    if (refId.startsWith(WIZ_CHAR_PREFIX)) {
      label =
        script.characters?.find((c) => c.id === refId.slice(WIZ_CHAR_PREFIX.length))
          ?.name ?? token;
    } else if (refId.startsWith(WIZ_SCENE_PREFIX)) {
      label =
        script.scenes?.find((s) => s.id === refId.slice(WIZ_SCENE_PREFIX.length))
          ?.name ?? token;
    } else if (refId.startsWith(WIZ_PROP_PREFIX)) {
      label =
        script.props?.find((p) => p.id === refId.slice(WIZ_PROP_PREFIX.length))
          ?.name ?? token;
    }
    out = out.split(token).join(label);
  }
  return out;
}

export type HydrateShotEntityMentionsResult = {
  shot: Pro2ProductionScriptShot;
  propDisplayText: string;
};

/** Pass2 润色/保存 · 单段提示词 canonical 名 → @<wiz-*> */
export function hydrateWizardPromptTextForShot(
  text: string,
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
  options?: ReconcileShotEntityOptions,
): string {
  if (!text.trim()) return text;
  const reconciled = reconcileShotEntityLinks(shot, script, options);
  const entities = linkedEntitiesFromReconciledShot(reconciled, script);
  return hydrateWizardMentionsInText(text, entities);
}

/** 编辑弹层 · reconcile 后把已关联实体名替换为 @<wiz-*> */
export function hydrateShotEntityMentionsForEdit(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
  options?: ReconcileShotEntityOptions,
): HydrateShotEntityMentionsResult {
  const reconciled = reconcileShotEntityLinks(shot, script, options);
  const entities = linkedEntitiesFromReconciledShot(reconciled, script);
  const hydrate = (value: string | undefined) =>
    value ? hydrateWizardMentionsInText(value, entities) : value;

  const propBase =
    options?.propDisplayText?.trim() ||
    (reconciled.propIds ?? [])
      .map((id) => script.props?.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join("、") ||
    "";

  return {
    shot: {
      ...reconciled,
      sceneDescription: hydrate(reconciled.sceneDescription),
      lighting: hydrate(reconciled.lighting),
      cameraMove: hydrate(reconciled.cameraMove),
      dialogue: hydrate(reconciled.dialogue),
      sfxNote: hydrate(reconciled.sfxNote),
      frameImagePrompt: hydrate(resolvePro2ShotFrameImagePrompt(reconciled)),
      imagePrompt: hydrate(reconciled.imagePrompt),
      videoPrompt: hydrate(reconciled.videoPrompt),
    },
    propDisplayText: hydrate(propBase) || propBase,
  };
}

export function expandWizardMentionsForPrompt(
  text: string,
  script: Pro2ProductionScript,
): string {
  if (!text.trim()) return text;
  let out = text;
  const refs = parseReferencedIds(text);
  for (const refId of refs) {
    let summary = refId;
    if (refId.startsWith(WIZ_CHAR_PREFIX)) {
      summary = assetSummaryForPrompt(
        "character",
        refId.slice(WIZ_CHAR_PREFIX.length),
        script,
      );
    } else if (refId.startsWith(WIZ_SCENE_PREFIX)) {
      summary = assetSummaryForPrompt(
        "scene",
        refId.slice(WIZ_SCENE_PREFIX.length),
        script,
      );
    } else if (refId.startsWith(WIZ_PROP_PREFIX)) {
      summary = assetSummaryForPrompt(
        "prop",
        refId.slice(WIZ_PROP_PREFIX.length),
        script,
      );
    }
    const token = `@<${refId}>`;
    out = out.split(token).join(`【${summary}】`);
  }
  return out;
}

export function wizardMentionId(
  kind: Pro2WizardLinkedEntity["kind"],
  assetId: string,
): string {
  const prefix =
    kind === "character"
      ? WIZ_CHAR_PREFIX
      : kind === "scene"
        ? WIZ_SCENE_PREFIX
        : WIZ_PROP_PREFIX;
  return `${prefix}${assetId}`;
}

export { wizardAssetDraftKey };
