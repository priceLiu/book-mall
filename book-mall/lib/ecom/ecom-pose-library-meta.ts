import type { EcomPoseLibraryEntry } from "@/lib/ecom/ecom-pose-library-service";

export type EcomPoseGender = "male" | "female" | "unisex";

export const ECOM_POSE_GENDER_OPTIONS: ReadonlyArray<{
  value: EcomPoseGender;
  label: string;
}> = [
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "unisex", label: "全性别" },
];

export const ECOM_POSE_SCENE_TAG_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "电商", label: "电商" },
  { value: "通勤", label: "通勤" },
  { value: "扫街", label: "扫街" },
  { value: "夸张", label: "夸张" },
  { value: "游玩", label: "游玩" },
  { value: "运动", label: "运动" },
  { value: "商务", label: "商务" },
  { value: "生活", label: "生活" },
  { value: "影棚", label: "影棚" },
  { value: "户外", label: "户外" },
  { value: "红毯", label: "红毯" },
  { value: "戏剧", label: "戏剧" },
];

const VALID_GENDERS = new Set<EcomPoseGender>(["male", "female", "unisex"]);

export const POSE_CATEGORY_SCENE_TAGS: Record<string, string[]> = {
  A: ["电商", "影棚"],
  B: ["电商", "扫街", "运动"],
  C: ["电商", "扫街"],
  D: ["夸张", "戏剧"],
  E: ["电商", "影棚"],
  H: ["夸张", "游玩", "运动", "户外"],
  I: ["扫街", "生活", "游玩"],
  J: ["电商", "商务", "通勤"],
  K: ["夸张", "红毯", "商务"],
  L: ["夸张", "戏剧"],
  M: ["电商", "生活", "影棚"],
};

export function normalizePoseGenders(raw: unknown): EcomPoseGender[] {
  if (!Array.isArray(raw)) return ["unisex"];
  const out = raw.filter(
    (g): g is EcomPoseGender => typeof g === "string" && VALID_GENDERS.has(g as EcomPoseGender),
  );
  return out.length ? [...new Set(out)] : ["unisex"];
}

export function normalizePoseSceneTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(ECOM_POSE_SCENE_TAG_OPTIONS.map((o) => o.value));
  const out = raw.filter((t): t is string => typeof t === "string" && allowed.has(t));
  return [...new Set(out)];
}

export function resolvePoseGenders(entry: Pick<EcomPoseLibraryEntry, "genders" | "tags">): EcomPoseGender[] {
  if (entry.genders?.length) return normalizePoseGenders(entry.genders);
  const tags = entry.tags;
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    return normalizePoseGenders((tags as Record<string, unknown>).genders);
  }
  return ["unisex"];
}

export function resolvePoseSceneTags(entry: Pick<EcomPoseLibraryEntry, "sceneTags" | "tags" | "category">): string[] {
  if (entry.sceneTags?.length) return normalizePoseSceneTags(entry.sceneTags);
  const tags = entry.tags;
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    const fromTags = normalizePoseSceneTags((tags as Record<string, unknown>).sceneTags);
    if (fromTags.length) return fromTags;
  }
  return inferSceneTagsFromCategory(entry.category);
}

export function inferSceneTagsFromCategory(category?: string | null): string[] {
  const key = (category ?? "").trim().toUpperCase();
  return normalizePoseSceneTags(POSE_CATEGORY_SCENE_TAGS[key] ?? ["电商"]);
}

export function inferCategoryFromDescription(description: string): string {
  const text = description.trim();
  if (/背对镜头|背对|背面/.test(text)) return "E";
  if (/行走|边走边|向前行走|大步迈|猫步|迈步定格|走动定格/.test(text)) return "B";
  if (/倚靠|倚在|单膝跪|半跪|单膝微屈|蹲/.test(text)) return /单膝|半跪|蹲/.test(text) ? "D" : "I";
  if (/90°|大侧身|大字形|跳跃|腾空|星形/.test(text)) return /跳跃|腾空|星形|大字形/.test(text) ? "H" : "C";
  if (/侧身|45°|45 度|三分之二|侧对|斜侧|半侧/.test(text)) return "C";
  if (/双臂.*展开|张开双臂|大幅度展开|呈.*展开|旋转|谢幕|戏剧|夸张倾斜|S 型/.test(text)) {
    return "L";
  }
  if (/红毯|女王|超模定点|封面大片|冷艳|压轴/.test(text)) return "K";
  if (/张开|举高|比心|比 OK|大字形|挥手/.test(text)) return "H";
  return "A";
}

export function inferDramaticCategoryFromDescription(description: string): string {
  const text = description.trim();
  if (/半跪|单膝微屈|单膝/.test(text)) return "D";
  if (/背对镜头|背影杀|背对/.test(text)) return "E";
  if (/猫步|迈步定格|走动定格|迈步/.test(text)) return "B";
  if (/双臂.*展开|张开双臂|大幅度展开|呈.*展开|旋转|谢幕|夸张倾斜|S 型|低角度/.test(text)) {
    return "L";
  }
  if (/90°|大侧身|侧弯|斜侧|半侧|45°|45 度/.test(text)) return "C";
  return "K";
}

export function mergePoseEntryTags(
  existing: Record<string, unknown> | undefined,
  meta: { genders?: EcomPoseGender[]; sceneTags?: string[] },
): Record<string, unknown> {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  if (meta.genders?.length) base.genders = normalizePoseGenders(meta.genders);
  if (meta.sceneTags?.length) base.sceneTags = normalizePoseSceneTags(meta.sceneTags);
  return base;
}

export function attachPoseMeta(entry: EcomPoseLibraryEntry): EcomPoseLibraryEntry {
  const genders = resolvePoseGenders(entry);
  const sceneTags = resolvePoseSceneTags(entry);
  return {
    ...entry,
    genders,
    sceneTags,
    tags: mergePoseEntryTags(entry.tags, { genders, sceneTags }),
  };
}

export function matchesPoseGenderFilter(
  entry: Pick<EcomPoseLibraryEntry, "genders" | "tags">,
  selected: EcomPoseGender[],
): boolean {
  if (!selected.length) return true;
  const entryGenders = resolvePoseGenders(entry);
  if (entryGenders.includes("unisex")) return true;
  return selected.some((g) => entryGenders.includes(g));
}

export function matchesPoseSceneTagFilter(
  entry: Pick<EcomPoseLibraryEntry, "sceneTags" | "tags" | "category">,
  selected: string[],
): boolean {
  if (!selected.length) return true;
  const tags = resolvePoseSceneTags(entry);
  return selected.some((t) => tags.includes(t));
}

export function filterPoseEntries<T extends EcomPoseLibraryEntry>(
  entries: T[],
  filters: { genders?: EcomPoseGender[]; sceneTags?: string[] },
): T[] {
  const genders = filters.genders ?? [];
  const sceneTags = filters.sceneTags ?? [];
  if (!genders.length && !sceneTags.length) return entries;
  return entries.filter(
    (e) => matchesPoseGenderFilter(e, genders) && matchesPoseSceneTagFilter(e, sceneTags),
  );
}

export type ParsedPoseMdRow = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  genders: EcomPoseGender[];
  sceneTags: string[];
  sortOrder: number;
  sourceKey: string;
};

type MdSection =
  | "comm-female"
  | "comm-male"
  | "travel-female"
  | "travel-male"
  | "dramatic-female"
  | "dramatic-male"
  | null;

function sectionFromLine(line: string): MdSection {
  if (/女装通勤/.test(line)) return "comm-female";
  if (/男装通勤/.test(line)) return "comm-male";
  if (/女生.*旅游/.test(line)) return "travel-female";
  if (/男生.*旅游/.test(line)) return "travel-male";
  if (/女生.*红毯|女生.*大动作/.test(line)) return "dramatic-female";
  if (/男生.*红毯|男生.*大动作/.test(line)) return "dramatic-male";
  return null;
}

function buildRow(section: Exclude<MdSection, null>, index: number, description: string): ParsedPoseMdRow {
  const n = String(index).padStart(2, "0");
  if (section === "comm-female") {
    return {
      id: `COMM-F-${n}`,
      category: inferCategoryFromDescription(description),
      title: `通勤站姿 · 女装 · ${n}`,
      baseDescription: description,
      genders: ["female"],
      sceneTags: ["电商", "通勤", "影棚"],
      sortOrder: index,
      sourceKey: `md:comm-female:${index}`,
    };
  }
  if (section === "comm-male") {
    return {
      id: `COMM-M-${n}`,
      category: inferCategoryFromDescription(description),
      title: `通勤站姿 · 男装 · ${n}`,
      baseDescription: description,
      genders: ["male"],
      sceneTags: ["电商", "通勤", "影棚"],
      sortOrder: 100 + index,
      sourceKey: `md:comm-male:${index}`,
    };
  }
  if (section === "travel-female") {
    return {
      id: `TRAV-F-${n}`,
      category: inferCategoryFromDescription(description),
      title: `旅游玩乐 · 女装 · ${n}`,
      baseDescription: description,
      genders: ["female"],
      sceneTags: ["游玩", "扫街", "生活", "户外"],
      sortOrder: 1000 + index,
      sourceKey: `md:travel-female:${index}`,
    };
  }
  if (section === "travel-male") {
    return {
      id: `TRAV-M-${n}`,
      category: inferCategoryFromDescription(description),
      title: `旅游玩乐 · 男装 · ${n}`,
      baseDescription: description,
      genders: ["male"],
      sceneTags: ["游玩", "扫街", "生活", "户外"],
      sortOrder: 1100 + index,
      sourceKey: `md:travel-male:${index}`,
    };
  }
  if (section === "dramatic-female") {
    return {
      id: `DRAM-F-${n}`,
      category: inferDramaticCategoryFromDescription(description),
      title: `红毯大动作 · 女装 · ${n}`,
      baseDescription: description,
      genders: ["female"],
      sceneTags: ["夸张", "红毯", "戏剧"],
      sortOrder: 2000 + index,
      sourceKey: `md:dramatic-female:${index}`,
    };
  }
  return {
    id: `DRAM-M-${n}`,
    category: inferDramaticCategoryFromDescription(description),
    title: `红毯大动作 · 男装 · ${n}`,
    baseDescription: description,
    genders: ["male"],
    sceneTags: ["夸张", "红毯", "戏剧"],
    sortOrder: 2100 + index,
    sourceKey: `md:dramatic-male:${index}`,
  };
}

/** 解析 docs/姿势库md 中的编号姿势条目 */
export function parsePoseLibraryMarkdown(content: string): ParsedPoseMdRow[] {
  let section: MdSection = null;
  const counters: Record<Exclude<MdSection, null>, number> = {
    "comm-female": 0,
    "comm-male": 0,
    "travel-female": 0,
    "travel-male": 0,
    "dramatic-female": 0,
    "dramatic-male": 0,
  };
  const rows: ParsedPoseMdRow[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const nextSection = sectionFromLine(line);
    if (nextSection) {
      section = nextSection;
      continue;
    }
    if (!section) continue;
    const match = line.match(/^\d+\.\s+(.+)$/);
    if (!match?.[1]) continue;
    counters[section] += 1;
    rows.push(buildRow(section, counters[section], match[1].trim()));
  }

  return rows;
}

export function backfillLegacyPoseMeta(entry: EcomPoseLibraryEntry): {
  genders: EcomPoseGender[];
  sceneTags: string[];
} {
  const existingGenders = resolvePoseGenders(entry);
  const existingTags = resolvePoseSceneTags(entry);
  const hasCustomGenders =
    entry.tags &&
    typeof entry.tags === "object" &&
    !Array.isArray(entry.tags) &&
    Array.isArray((entry.tags as Record<string, unknown>).genders);
  const hasCustomSceneTags =
    entry.tags &&
    typeof entry.tags === "object" &&
    !Array.isArray(entry.tags) &&
    Array.isArray((entry.tags as Record<string, unknown>).sceneTags) &&
    normalizePoseSceneTags((entry.tags as Record<string, unknown>).sceneTags).length > 0;

  return {
    genders: hasCustomGenders ? existingGenders : ["unisex"],
    sceneTags: hasCustomSceneTags ? existingTags : inferSceneTagsFromCategory(entry.category),
  };
}
