/**
 * 分镜图/分镜视频 · 提示词 @ 自动关联 + 参考图目录（向导 + 画布共用）
 */
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type {
  Pro2ProductionScriptShot,
  Pro2ProductionWizardAssetDraft,
  Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import {
  defaultWizardShotPrompt,
  type Pro2WizardShotMediaKind,
} from "@/lib/canvas/pro2-production-wizard-shot-drafts";
import {
  hydrateWizardPromptTextForShot,
  reconcileShotEntityLinks,
  wizardMentionId,
} from "@/lib/canvas/pro2-shot-entity-reconcile";
import {
  buildWizardMentionRefCatalog,
  parseWizardMentionRefIdsInOrder,
} from "@/lib/canvas/pro2-wizard-mention-ref-urls";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { storyRefMentionToken } from "@/lib/canvas/story-ref-image";

const WIZ_CHAR_PREFIX = "wiz-char-";
const WIZ_SCENE_PREFIX = "wiz-scene-";
const WIZ_PROP_PREFIX = "wiz-prop-";

type MentionEntity = { id: string; name: string };

const STORE_TOKEN_RE = /@<([^>\s]+)>/g;

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

function pointInMention(ranges: TextRange[], pos: number): boolean {
  return ranges.some((r) => pos >= r.start && pos < r.end);
}

function rangeCovers(ranges: TextRange[], start: number, len: number): boolean {
  const end = start + len;
  return ranges.some((r) => start >= r.start && end <= r.end);
}

type HydrationTerm = { term: string; id: string };

function buildCanvasHydrationTerms(
  text: string,
  entities: MentionEntity[],
): HydrationTerm[] {
  const terms: HydrationTerm[] = [];
  const seen = new Set<string>();
  const push = (term: string, id: string) => {
    const t = term.trim();
    if (t.length < 2 || !text.includes(t)) return;
    const key = `${id}:${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    terms.push({ term: t, id });
  };

  for (const entity of entities) {
    push(entity.name, entity.id);
    for (const part of entity.name.split(/[·•／/|、，,]/)) {
      push(part, entity.id);
    }
  }

  return terms.sort((a, b) => b.term.length - a.term.length);
}

/** 画布分镜 · 纯文本角色/场景/道具名 → @<ref-*> token */
export function hydrateCanvasFramePromptMentions(
  text: string,
  entities: MentionEntity[],
): string {
  if (!text.trim() || !entities.length) return text;
  const protectedRanges = existingMentionRanges(text);
  const terms = buildCanvasHydrationTerms(text, entities);
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
      out += storyRefMentionToken(matched.id);
      i += matched.term.length;
      continue;
    }

    out += text[i]!;
    i += 1;
  }
  return out;
}

export function labelForWizardMentionId(
  id: string,
  script: Pro2ProductionScript,
): string {
  if (id.startsWith(WIZ_CHAR_PREFIX)) {
    const assetId = id.slice(WIZ_CHAR_PREFIX.length);
    const c = script.characters?.find((x) => x.id === assetId);
    return c ? `角色 · ${c.name}` : id;
  }
  if (id.startsWith(WIZ_SCENE_PREFIX)) {
    const assetId = id.slice(WIZ_SCENE_PREFIX.length);
    const s = script.scenes?.find((x) => x.id === assetId);
    return s ? `场景 · ${s.name}` : id;
  }
  if (id.startsWith(WIZ_PROP_PREFIX)) {
    const assetId = id.slice(WIZ_PROP_PREFIX.length);
    const p = script.props?.find((x) => x.id === assetId);
    return p ? `道具 · ${p.name}` : id;
  }
  return id;
}

type LinkedWizardEntity = {
  kind: Pro2WizardAssetKind;
  id: string;
  name: string;
};

function linkedWizardEntitiesForShot(
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): LinkedWizardEntity[] {
  const reconciled = reconcileShotEntityLinks(shot, script);
  const out: LinkedWizardEntity[] = [];
  for (const id of reconciled.characterIds ?? []) {
    const c = script.characters?.find((x) => x.id === id);
    if (c) out.push({ kind: "character", id: c.id, name: c.name });
  }
  if (reconciled.sceneId) {
    const s = script.scenes?.find((x) => x.id === reconciled.sceneId);
    if (s) out.push({ kind: "scene", id: s.id, name: s.name });
  }
  for (const id of reconciled.propIds ?? []) {
    const p = script.props?.find((x) => x.id === id);
    if (p) out.push({ kind: "prop", id: p.id, name: p.name });
  }
  return out;
}

/** 无 Pass2 或正文未 @ 时 · 按镜号关联实体补 @<wiz-*> 前缀 */
function ensureWizardLinkedEntityMentions(
  prompt: string,
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
): string {
  const entities = linkedWizardEntitiesForShot(shot, script);
  if (!entities.length) return prompt;
  const existing = new Set(parseWizardMentionRefIdsInOrder(prompt));
  const missing = entities.filter(
    (e) => !existing.has(wizardMentionId(e.kind, e.id)),
  );
  if (!missing.length) return prompt;
  const prefix = missing
    .map((e) => storyRefMentionToken(wizardMentionId(e.kind, e.id)))
    .join(" ");
  const base = prompt.trim();
  return base ? `${prefix}\n${base}` : prefix;
}

function buildWizardRefImagesForEditor(
  prompt: string,
  shot: Pro2ProductionScriptShot,
  script: Pro2ProductionScript,
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>,
): StoryRefImage[] {
  const catalog = buildWizardMentionRefCatalog(assetDrafts, []);
  const urlById = new Map(catalog.map((c) => [c.id, c.url]));
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    orderedIds.push(id);
  };
  for (const id of parseWizardMentionRefIdsInOrder(prompt)) push(id);
  for (const entity of linkedWizardEntitiesForShot(shot, script)) {
    push(wizardMentionId(entity.kind, entity.id));
  }
  return orderedIds.map((id) => ({
    id,
    label: labelForWizardMentionId(id, script),
    url: urlById.get(id),
  }));
}

/** 向导 Studio · 打开时：Pass2 纯文本 → 彩色 @ + 参考图缩略图列表 */
export function prepareWizardShotEditorState(args: {
  prompt: string;
  mediaKind: Pro2WizardShotMediaKind;
  script: Pro2ProductionScript;
  shot: Pro2ProductionScriptShot;
  assetDrafts?: Record<string, Pro2ProductionWizardAssetDraft>;
}): { prompt: string; refImages: StoryRefImage[] } {
  const seed =
    args.prompt.trim() ||
    defaultWizardShotPrompt(args.mediaKind, args.shot).trim();
  let hydratedPrompt = hydrateWizardPromptTextForShot(
    seed,
    args.shot,
    args.script,
  );
  hydratedPrompt = ensureWizardLinkedEntityMentions(
    hydratedPrompt,
    args.shot,
    args.script,
  );
  const refImages = buildWizardRefImagesForEditor(
    hydratedPrompt,
    args.shot,
    args.script,
    args.assetDrafts,
  );

  return { prompt: hydratedPrompt, refImages };
}

export function wizardAssetKindFromMentionId(
  id: string,
): Pro2WizardAssetKind | null {
  if (id.startsWith(WIZ_CHAR_PREFIX)) return "character";
  if (id.startsWith(WIZ_SCENE_PREFIX)) return "scene";
  if (id.startsWith(WIZ_PROP_PREFIX)) return "prop";
  return null;
}

/** 从 shot 关联实体 + asset draft 构建 mention id（供画布 catalog） */
export function canvasRefIdForWizardEntity(
  kind: Pro2WizardAssetKind,
  assetId: string,
): string {
  return wizardMentionId(kind, assetId);
}
