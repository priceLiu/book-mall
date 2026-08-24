import { parseReferencedIds } from "@/lib/canvas/dock-mention-parse";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import type { Pro2ProductionWizardAssetDraft } from "@/lib/canvas/pro2-production-wizard-assets";
import {
  parseWizardAssetDraftKey,
  wizardAssetDraftKey,
  type Pro2WizardAssetKind,
} from "@/lib/canvas/pro2-production-wizard-assets";
import { wizardMentionId } from "@/lib/canvas/pro2-shot-entity-reconcile";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";
import { WIZARD_MENTION_PROMPT_RE } from "@/lib/canvas/wizard-mention-chrome";

export type WizardMentionRefCatalogItem = {
  id: string;
  url: string;
};

const WIZ_CHAR_PREFIX = "wiz-char-";
const WIZ_SCENE_PREFIX = "wiz-scene-";
const WIZ_PROP_PREFIX = "wiz-prop-";

export function isWizardAssetMentionId(id: string): boolean {
  return (
    id.startsWith(WIZ_CHAR_PREFIX) ||
    id.startsWith(WIZ_SCENE_PREFIX) ||
    id.startsWith(WIZ_PROP_PREFIX)
  );
}

/** prompt 内 @ 引用 id（@<wiz-*> / 裸 @wiz-* / 其它 @<refId>），按出现顺序去重 */
export function parseWizardMentionRefIdsInOrder(prompt: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  WIZARD_MENTION_PROMPT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIZARD_MENTION_PROMPT_RE.exec(prompt)) !== null) {
    const id = (m[1] ?? m[2])?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  for (const id of parseReferencedIds(prompt)) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }

  return out;
}

/** Step1 资产 draft previewUrl + 手动上传 ref → mention 可解析 catalog */
export function buildWizardMentionRefCatalog(
  assetDrafts: Record<string, Pro2ProductionWizardAssetDraft> | undefined,
  refImages: StoryRefImage[],
): WizardMentionRefCatalogItem[] {
  const catalog: WizardMentionRefCatalogItem[] = [];
  const seenIds = new Set<string>();

  for (const [key, draft] of Object.entries(assetDrafts ?? {})) {
    const parsed = parseWizardAssetDraftKey(key);
    if (!parsed) continue;
    const url = draft.previewUrl?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const id = wizardMentionId(parsed.kind, parsed.assetId);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    catalog.push({ id, url });
  }

  for (const ref of refImages) {
    const url = ref.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (seenIds.has(ref.id)) continue;
    seenIds.add(ref.id);
    catalog.push({ id: ref.id, url });
  }

  return catalog;
}

/**
 * 向导生图/生视频 · 参考图 URL：
 * - `@<wiz-*>` / 手动 ref 区 @：只传 prompt 内被引用且已出图的项（顺序一致）
 * - 手动上传 ref（非 wiz-* id）：始终传入（参考图区显式添加）
 * - 禁止把页面上所有已出图资产当作 fallback 全传
 */
export function wizardMentionRefUrlsForPrompt(
  prompt: string,
  catalog: WizardMentionRefCatalogItem[],
  refImages: StoryRefImage[] = [],
): string[] {
  const byId = new Map(catalog.map((c) => [c.id, c.url]));
  const out: string[] = [];
  const seen = new Set<string>();

  const pushUrl = (url: string | undefined) => {
    const u = url?.trim();
    if (!u || !/^https?:\/\//i.test(u) || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  for (const id of parseWizardMentionRefIdsInOrder(prompt)) {
    pushUrl(byId.get(id));
  }

  for (const ref of refImages) {
    if (isWizardAssetMentionId(ref.id)) continue;
    pushUrl(ref.url);
  }

  return out.slice(0, 8);
}

/** 视频行 refImages：仅 @ 引用 + 手动 ref 区（不含未引用的 wiz 资产） */
export function mergeWizardMentionRefImages(
  prompt: string,
  catalog: WizardMentionRefCatalogItem[],
  refImages: StoryRefImage[],
): StoryRefImage[] {
  const byId = new Map<string, StoryRefImage>();
  for (const ref of refImages) {
    if (ref.url?.trim()) byId.set(ref.id, ref);
  }
  for (const item of catalog) {
    if (!byId.has(item.id)) {
      byId.set(item.id, { id: item.id, label: item.id, url: item.url });
    }
  }

  const out: StoryRefImage[] = [];
  const seen = new Set<string>();

  for (const id of parseWizardMentionRefIdsInOrder(prompt)) {
    const ref = byId.get(id);
    if (ref && !seen.has(id)) {
      seen.add(id);
      out.push(ref);
    }
  }

  for (const ref of refImages) {
    if (isWizardAssetMentionId(ref.id)) continue;
    if (!seen.has(ref.id)) {
      seen.add(ref.id);
      out.push(ref);
    }
  }

  return out;
}

export function readProductionWizardAssetDraftsFromHub(
  hubData: { productionWizardAssetDrafts?: Record<string, Pro2ProductionWizardAssetDraft> } | null | undefined,
): Record<string, Pro2ProductionWizardAssetDraft> {
  return hubData?.productionWizardAssetDrafts ?? {};
}

export type MissingWizardAssetMention = {
  id: string;
  label: string;
  kind: Pro2WizardAssetKind;
};

function wizardAssetPreviewReady(
  kind: Pro2WizardAssetKind,
  assetId: string,
  assetDrafts: Record<string, Pro2ProductionWizardAssetDraft> | undefined,
): boolean {
  const url = assetDrafts?.[wizardAssetDraftKey(kind, assetId)]?.previewUrl?.trim();
  return Boolean(url && /^https?:\/\//i.test(url));
}

function resolveMissingWizardAssetMention(
  id: string,
  script: Pro2ProductionScript,
): MissingWizardAssetMention | null {
  if (id.startsWith(WIZ_CHAR_PREFIX)) {
    const assetId = id.slice(WIZ_CHAR_PREFIX.length);
    const c = script.characters?.find((x) => x.id === assetId);
    return {
      id,
      kind: "character",
      label: c ? `角色 · ${c.name}` : id,
    };
  }
  if (id.startsWith(WIZ_SCENE_PREFIX)) {
    const assetId = id.slice(WIZ_SCENE_PREFIX.length);
    const s = script.scenes?.find((x) => x.id === assetId);
    return {
      id,
      kind: "scene",
      label: s ? `场景 · ${s.name}` : id,
    };
  }
  if (id.startsWith(WIZ_PROP_PREFIX)) {
    const assetId = id.slice(WIZ_PROP_PREFIX.length);
    const p = script.props?.find((x) => x.id === assetId);
    return {
      id,
      kind: "prop",
      label: p ? `道具 · ${p.name}` : id,
    };
  }
  return null;
}

/** prompt 中 @ 引用的 Step1 资产 · 尚未出图（无 previewUrl） */
export function listMissingWizardAssetMentions(
  prompt: string,
  script: Pro2ProductionScript | undefined,
  assetDrafts: Record<string, Pro2ProductionWizardAssetDraft> | undefined,
): MissingWizardAssetMention[] {
  if (!prompt.trim() || !script) return [];

  const missing: MissingWizardAssetMention[] = [];
  const seen = new Set<string>();

  for (const id of parseWizardMentionRefIdsInOrder(prompt)) {
    if (seen.has(id)) continue;
    seen.add(id);

    const mention = resolveMissingWizardAssetMention(id, script);
    if (!mention) continue;

    const assetId = id.slice(
      mention.kind === "character"
        ? WIZ_CHAR_PREFIX.length
        : mention.kind === "scene"
          ? WIZ_SCENE_PREFIX.length
          : WIZ_PROP_PREFIX.length,
    );
    if (wizardAssetPreviewReady(mention.kind, assetId, assetDrafts)) continue;
    missing.push(mention);
  }

  return missing;
}

export function missingWizardAssetMentionsConfirmCopy(
  missing: MissingWizardAssetMention[],
): { title: string; message: string } {
  const n = missing.length;
  const list = missing.map((m) => `· ${m.label}`).join("\n");
  return {
    title: `${n} 个引用资产尚未出图`,
    message: `提示词中以下 ${n} 个资产还没有 Step1 出图结果，无法作为参考图传入：\n\n${list}\n\n仍要生成将跳过上述引用，仅使用已出图资产与手动上传的参考图。是否继续？`,
  };
}

export { wizardAssetDraftKey };
