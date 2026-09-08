import { z } from "zod";

import type {
  CharacterWardrobeEntry,
  MediaDecomposePatch,
  ReplicaAssetCatalog,
  ReplicaAssetCatalogEntry,
} from "@/lib/ecom/ecom-media-decompose-structured";

export const REPLICA_ASSET_CATEGORY = ["character", "product", "prop", "scene"] as const;
export type ReplicaAssetCategory = (typeof REPLICA_ASSET_CATEGORY)[number];

export const REPLICA_ASSET_MAX_PER_CATEGORY = 6;

const CHAR_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export const replicaAssetPlanSlotSchema = z.object({
  id: z.string().min(1),
  category: z.enum(REPLICA_ASSET_CATEGORY),
  label: z.string().min(1),
  description: z.string().default(""),
  /** 人物槽 · 原片服装（replace 时须从 Prompt 剥离） */
  wardrobe: z.string().optional(),
  roleInShot: z.string().optional(),
});

export type ReplicaAssetPlanSlot = z.infer<typeof replicaAssetPlanSlotSchema>;

export const replicaAssetPlanSchema = z.object({
  characters: z.array(replicaAssetPlanSlotSchema).default([]),
  products: z.array(replicaAssetPlanSlotSchema).default([]),
  props: z.array(replicaAssetPlanSlotSchema).default([]),
  scenes: z.array(replicaAssetPlanSlotSchema).default([]),
});

export type ReplicaAssetPlan = z.infer<typeof replicaAssetPlanSchema>;

export function parseReplicaAssetPlan(raw: unknown): ReplicaAssetPlan | null {
  const parsed = replicaAssetPlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function readReplicaAssetPlan(meta: Record<string, unknown> | null | undefined): ReplicaAssetPlan | null {
  if (!meta || typeof meta !== "object") return null;
  return parseReplicaAssetPlan(meta.replicaAssetPlan);
}

export function listReplicaAssetPlanSlots(plan: ReplicaAssetPlan): ReplicaAssetPlanSlot[] {
  return [...plan.characters, ...plan.products, ...plan.props, ...plan.scenes];
}

export function replicaAssetSlotToken(slot: Pick<ReplicaAssetPlanSlot, "label">): string {
  const compact = slot.label.replace(/\s+/g, "");
  return compact.startsWith("@") ? compact : `@${compact}`;
}

function parseCharacterCount(raw: string): number {
  const text = raw.trim();
  if (!text) return 1;
  if (/【无出镜模特】|无出镜|无人物/.test(text)) return 0;
  const letterMatches = text.match(/人物\s*[A-Fa-f]/g);
  if (letterMatches) {
    const letters = new Set(letterMatches.map((m) => m.replace(/\s+/g, "").toUpperCase()));
    return Math.min(REPLICA_ASSET_MAX_PER_CATEGORY, letters.size);
  }
  const digit = text.match(/(\d+)\s*[位个名]/);
  if (digit) {
    const n = Number.parseInt(digit[1]!, 10);
    if (Number.isFinite(n) && n > 0) return Math.min(REPLICA_ASSET_MAX_PER_CATEGORY, n);
  }
  if (/两|二|2/.test(text) && /人|模|主角|人物/.test(text)) return 2;
  if (/三|3/.test(text) && /人|模|人物/.test(text)) return 3;
  if (/四|4/.test(text) && /人|模|人物/.test(text)) return 4;
  return 1;
}

function characterLabel(index: number): string {
  return `人物${CHAR_LETTERS[index] ?? String(index + 1)}`;
}

function characterId(index: number): string {
  return `char-${String.fromCharCode(97 + index)}`;
}

function slotIdForCategory(category: ReplicaAssetCategory, index: number): string {
  switch (category) {
    case "character":
      return characterId(index);
    case "product":
      return `product-${index + 1}`;
    case "prop":
      return `prop-${index + 1}`;
    case "scene":
      return `scene-${index + 1}`;
  }
}

function normalizeCatalogLabel(label: string, category: ReplicaAssetCategory, index: number): string {
  const trimmed = label.trim();
  if (trimmed) return trimmed.replace(/^@/, "");
  switch (category) {
    case "character":
      return characterLabel(index);
    case "product":
      return `产品${index + 1}`;
    case "prop":
      return `道具${index + 1}`;
    case "scene":
      return `场景${index + 1}`;
  }
}

function normalizeCharacterLabel(label: string): string {
  return label.replace(/^@/, "").replace(/\s+/g, "");
}

function findWardrobeForCharacter(
  wardrobes: CharacterWardrobeEntry[] | undefined,
  label: string,
): string | undefined {
  if (!wardrobes?.length) return undefined;
  const normalized = normalizeCharacterLabel(label);
  const entry = wardrobes.find(
    (w) => normalizeCharacterLabel(w.characterLabel) === normalized,
  );
  if (!entry) return undefined;
  return [entry.garments.trim(), entry.stylingNotes?.trim()].filter(Boolean).join("，") || undefined;
}

function optionalProductPlaceholder(): ReplicaAssetPlanSlot {
  return {
    id: "product-1",
    category: "product",
    label: "产品1",
    description: "（原片无独立产品；可上传后在复刻中新增展示）",
    roleInShot: "可选售卖/展示主体",
  };
}

function slotsFromCatalogEntries(
  category: ReplicaAssetCategory,
  entries: ReplicaAssetCatalogEntry[],
  catalog?: ReplicaAssetCatalog,
): ReplicaAssetPlanSlot[] {
  return entries.slice(0, REPLICA_ASSET_MAX_PER_CATEGORY).map((entry, index) => {
    const label = normalizeCatalogLabel(entry.label, category, index);
    const wardrobe =
      category === "character" && catalog
        ? findWardrobeForCharacter(catalog.characterWardrobe, label)
        : undefined;
    return {
      id: slotIdForCategory(category, index),
      category,
      label,
      description: entry.description.trim(),
      ...(wardrobe ? { wardrobe } : {}),
      roleInShot: entry.roleInShot?.trim() || undefined,
    };
  });
}

function readCatalog(structured: MediaDecomposePatch): ReplicaAssetCatalog | null {
  const catalog = structured.replicaAssetCatalog;
  if (!catalog) return null;
  const total =
    catalog.characters.length +
    catalog.products.length +
    catalog.props.length +
    catalog.scenes.length;
  return total > 0 ? catalog : null;
}

function buildCharacterSlots(structured: MediaDecomposePatch): ReplicaAssetPlanSlot[] {
  const catalog = readCatalog(structured);
  if (catalog?.characters.length) {
    return slotsFromCatalogEntries("character", catalog.characters, catalog);
  }

  const sharedWardrobe =
    structured.mediaType === "video"
      ? structured.wardrobeAnalysis.garments.trim() || undefined
      : undefined;

  if (structured.mediaType === "image") {
    const e = structured.elements;
    const rep = structured.liveActionReplication;
    const count = Math.max(
      1,
      parseCharacterCount([rep.talentBlocking, e.subject, e.subjectPose].filter(Boolean).join("\n")) || 1,
    );
    const baseDesc = [e.subject, e.subjectPose, rep.talentBlocking].filter(Boolean).join("，");
    return Array.from({ length: Math.min(count, REPLICA_ASSET_MAX_PER_CATEGORY) }, (_, i) => ({
      id: characterId(i),
      category: "character" as const,
      label: characterLabel(i),
      description:
        i === 0
          ? baseDesc || e.subject || "原片画面主体人物"
          : `${characterLabel(i)}：与 ${characterLabel(0)} 同框出现，继承原片走位关系（${rep.talentBlocking || "见原片"}）`,
      ...(i === 0 && sharedWardrobe ? { wardrobe: sharedWardrobe } : {}),
      roleInShot: i === 0 ? "主人物" : "同框人物",
    }));
  }

  const talent = structured.talentAnalysis;
  const count = Math.max(
    1,
    parseCharacterCount([talent.count, talent.blocking, talent.appearance].filter(Boolean).join("\n")) || 1,
  );
  const baseDesc = [talent.appearance, talent.expressionStyle, talent.blocking].filter(Boolean).join("，");
  return Array.from({ length: Math.min(count, REPLICA_ASSET_MAX_PER_CATEGORY) }, (_, i) => ({
    id: characterId(i),
    category: "character" as const,
    label: characterLabel(i),
    description:
      i === 0
        ? baseDesc || talent.appearance || "原片出镜人物"
        : `${characterLabel(i)}：${talent.blocking || "与主人物同框，见原片分镜"}`,
    ...(i === 0 && sharedWardrobe ? { wardrobe: sharedWardrobe } : {}),
    roleInShot: i === 0 ? "主模特" : "同框模特",
  }));
}

function buildProductSlots(structured: MediaDecomposePatch): ReplicaAssetPlanSlot[] {
  const catalog = readCatalog(structured);
  if (catalog?.products.length) {
    return slotsFromCatalogEntries("product", catalog.products, catalog);
  }

  if (structured.mediaType === "image") {
    const e = structured.elements;
    const subject = e.subject.trim();
    const isProductLead = /产品|商品|SKU|包|鞋|衣|裙|裤|开衫|连衣裙|饰品/.test(subject);
    if (!isProductLead && !structured.positivePrompt.trim()) {
      return [optionalProductPlaceholder()];
    }
    return [
      {
        id: "product-1",
        category: "product",
        label: "产品1",
        description: [subject, e.materialTexture, e.detailNotes].filter(Boolean).join("，") || "原片展示商品",
        roleInShot: "售卖主体",
      },
    ];
  }

  const wardrobe = structured.wardrobeAnalysis;
  const productHint = structured.storyboardTable
    .map((r) => [r.visualContent, r.characterAction].filter(Boolean).join(" "))
    .join("\n");
  const hasProductMention = /产品|商品|包袋|手提|背包|SKU|手持展示|佩戴|试穿/.test(productHint);
  if (!hasProductMention) return [optionalProductPlaceholder()];
  const garments = wardrobe.garments.trim();
  return [
    {
      id: "product-1",
      category: "product",
      label: "产品1",
      description:
        productHint.slice(0, 200).trim() ||
        (garments ? `原片展示主体（非人物服装；服装见 characterWardrobe）` : "原片展示商品"),
      roleInShot: "售卖/展示主体",
    },
  ];
}

function buildPropSlots(structured: MediaDecomposePatch): ReplicaAssetPlanSlot[] {
  const catalog = readCatalog(structured);
  if (catalog?.props.length) {
    return slotsFromCatalogEntries("prop", catalog.props, catalog);
  }

  if (structured.mediaType === "image") {
    const props = structured.liveActionReplication.props.trim();
    if (!props || props === "无") return [];
    return [
      {
        id: "prop-1",
        category: "prop",
        label: "道具1",
        description: props,
        roleInShot: "画面道具",
      },
    ];
  }

  const fixed = structured.scenePrep.fixedProps.trim();
  if (!fixed) return [];
  return [
    {
      id: "prop-1",
      category: "prop",
      label: "道具1",
      description: fixed,
      roleInShot: "固定道具",
    },
  ];
}

function buildSceneSlots(structured: MediaDecomposePatch): ReplicaAssetPlanSlot[] {
  const catalog = readCatalog(structured);
  if (catalog?.scenes.length) {
    return slotsFromCatalogEntries("scene", catalog.scenes, catalog);
  }

  if (structured.mediaType === "image") {
    const e = structured.elements;
    const rep = structured.liveActionReplication;
    const desc = [e.sceneEnvironment, rep.sceneSetup].filter(Boolean).join("，");
    if (!desc) return [];
    return [
      {
        id: "scene-1",
        category: "scene",
        label: "场景1",
        description: desc,
        roleInShot: "拍摄环境",
      },
    ];
  }

  const venue = structured.scenePrep.venue.trim();
  if (!venue) return [];
  return [
    {
      id: "scene-1",
      category: "scene",
      label: "场景1",
      description: venue,
      roleInShot: "主拍摄场地",
    },
  ];
}

/** 从拆解结果机械抽取四槽复刻资产清单（人物可多位：A/B/C…） */
export function buildReplicaAssetPlanFromDecompose(structured: MediaDecomposePatch): ReplicaAssetPlan {
  const characters = buildCharacterSlots(structured);
  const products = buildProductSlots(structured);
  const props = buildPropSlots(structured);
  const scenes = buildSceneSlots(structured);
  return { characters, products, props, scenes };
}

export function formatReplicaAssetPlanForPrompt(plan: ReplicaAssetPlan): string {
  const lines: string[] = [];
  const section = (title: string, slots: ReplicaAssetPlanSlot[]) => {
    if (slots.length === 0) return;
    lines.push(`### ${title}`);
    for (const slot of slots) {
      lines.push(
        `- **${slot.label}**（id: \`${slot.id}\`，token: ${replicaAssetSlotToken(slot)}）${slot.roleInShot ? ` · ${slot.roleInShot}` : ""}`,
      );
      lines.push(`  - 原片描述：${slot.description || "（无）"}`);
      if (slot.wardrobe?.trim()) {
        lines.push(`  - 原片服装（replace 时须剥离）：${slot.wardrobe}`);
      }
    }
    lines.push("");
  };
  section("全身人物（可逐位替换；未上传则 inherit 外貌+服装，禁止写 @token）", plan.characters);
  section("产品（可新增；未上传则 inherit 或留空）", plan.products);
  section("道具", plan.props);
  section("场景", plan.scenes);
  return lines.join("\n").trim();
}

export function collectReplicaWardrobeFragments(
  plan: ReplicaAssetPlan,
  uploadedSlotIds: ReadonlySet<string>,
): string[] {
  const fragments: string[] = [];
  for (const slot of plan.characters) {
    if (!uploadedSlotIds.has(slot.id)) continue;
    if (slot.wardrobe?.trim()) fragments.push(slot.wardrobe.trim());
  }
  return fragments;
}

/** replace 槽位须从 Prompt 剥离的原片文字（服装 + 旧外貌/产品/道具/场景描述） */
export function collectReplicaStripFragments(
  plan: ReplicaAssetPlan,
  uploadedSlotIds: ReadonlySet<string>,
): string[] {
  const parts = new Set<string>(collectReplicaWardrobeFragments(plan, uploadedSlotIds));
  for (const slot of listReplicaAssetPlanSlots(plan)) {
    if (!uploadedSlotIds.has(slot.id)) continue;
    const desc = slot.description.trim();
    if (desc.length >= 4) parts.add(desc);
    for (const seg of desc.split(/[，,、；;\n]/)) {
      const p = seg.trim();
      if (p.length >= 4) parts.add(p);
    }
  }
  return [...parts].sort((a, b) => b.length - a.length);
}

export function buildReplicaAssetReplaceSummary(
  plan: ReplicaAssetPlan,
  uploadedSlotIds: ReadonlySet<string>,
  opts?: { productDisplayAction?: string },
): string {
  const lines: string[] = [];
  for (const slot of listReplicaAssetPlanSlots(plan)) {
    const token = replicaAssetSlotToken(slot);
    if (uploadedSlotIds.has(slot.id)) {
      if (slot.category === "character") {
        const wardrobeHint = slot.wardrobe
          ? `须剥离原片服装「${slot.wardrobe.slice(0, 100)}${slot.wardrobe.length > 100 ? "…" : ""}」`
          : "禁止写原片服装/造型文字";
        lines.push(
          `- ${slot.label}：**replace** → Prompt 须引用 ${token}；${wardrobeHint}；姿态/站位/同框关系保留`,
        );
      } else if (slot.category === "product") {
        const action = opts?.productDisplayAction?.trim();
        lines.push(
          `- ${slot.label}：**replace** → Prompt 须引用 ${token}${action ? `，展示动作：${action}` : "，并写清手持/佩戴/摆放等展示动作"}`,
        );
      } else {
        lines.push(
          `- ${slot.label}：**replace** → Prompt 须引用 ${token}，并写清与其他元素的空间/摆放关系`,
        );
      }
    } else if (slot.category === "character") {
      const wardrobe = slot.wardrobe?.trim();
      lines.push(
        `- ${slot.label}：**inherit** → 保留外貌「${slot.description.slice(0, 100)}${slot.description.length > 100 ? "…" : ""}」${wardrobe ? ` + 服装「${wardrobe.slice(0, 100)}${wardrobe.length > 100 ? "…" : ""}」` : ""}，**禁止** ${token}`,
      );
    } else {
      lines.push(
        `- ${slot.label}：**inherit** → 保留原片描述「${slot.description.slice(0, 120)}${slot.description.length > 120 ? "…" : ""}」，**禁止**出现 ${token}`,
      );
    }
  }
  return lines.join("\n");
}
