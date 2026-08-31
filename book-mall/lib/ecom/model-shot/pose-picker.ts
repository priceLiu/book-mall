import type { EcomPoseLibraryEntry } from "@/lib/ecom/ecom-pose-library-service";
import type { EcomPropLibraryEntry } from "@/lib/ecom/ecom-prop-library-service";
import type { EcomSceneLibraryEntry } from "@/lib/ecom/ecom-scene-library-service";

import {
  mergeStyleScenePriority,
  resolveSceneArchetype,
  sceneForbidsCategory,
} from "./scene-pose-rules";
import { applyStyleMicroAdjust } from "./style-micro-adjust";

type StyleKey =
  | "酷冷"
  | "活泼"
  | "夸张"
  | "优雅"
  | "慵懒"
  | "自信"
  | "性感"
  | "邻家";

const STYLE_ALIASES: Record<string, StyleKey> = {
  酷冷: "酷冷",
  高冷: "酷冷",
  疏离: "酷冷",
  活泼: "活泼",
  元气: "活泼",
  甜美: "活泼",
  夸张: "夸张",
  戏剧: "夸张",
  张力强: "夸张",
  优雅: "优雅",
  知性: "优雅",
  温柔: "优雅",
  慵懒: "慵懒",
  随性: "慵懒",
  松弛: "慵懒",
  自信: "自信",
  强大: "自信",
  霸气: "自信",
  性感: "性感",
  魅惑: "性感",
  邻家: "邻家",
  亲切: "邻家",
  自然: "邻家",
};

const PRIORITY: Record<StyleKey, string[]> = {
  酷冷: ["C", "E", "J", "K", "A"],
  活泼: ["B", "H", "I", "L"],
  夸张: ["H", "L", "D", "K"],
  优雅: ["J", "K", "C", "A"],
  慵懒: ["I", "A", "B", "E"],
  自信: ["K", "J", "C", "A", "L"],
  性感: ["K", "C", "E", "D", "L"],
  邻家: ["I", "B", "A", "H", "E"],
};

const FORBIDDEN: Record<StyleKey, string[]> = {
  酷冷: ["H", "L"],
  活泼: ["J", "K"],
  夸张: ["A", "J"],
  优雅: ["H", "L"],
  慵懒: ["J", "K", "H"],
  自信: ["I", "B"],
  性感: ["J", "A"],
  邻家: ["K", "L"],
};

const PROP_CATEGORY_BLOCK: Record<string, string[]> = {
  "prop-11": ["H", "L"],
  "prop-12": ["H", "L"],
  "prop-10": ["D", "L"],
};

function resolveStyle(styles: string[]): StyleKey {
  for (const s of styles) {
    const key = STYLE_ALIASES[s.trim()];
    if (key) return key;
  }
  return "优雅";
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function passesVeto(opts: {
  pose: EcomPoseLibraryEntry;
  style: StyleKey;
  prop?: EcomPropLibraryEntry | null;
  sceneArchetype: ReturnType<typeof resolveSceneArchetype>;
}): boolean {
  const cat = opts.pose.category;
  if (FORBIDDEN[opts.style].includes(cat)) return false;
  if (sceneForbidsCategory(opts.sceneArchetype, cat)) return false;
  if (opts.prop?.id && PROP_CATEGORY_BLOCK[opts.prop.id]?.includes(cat)) return false;
  if (opts.prop?.conflictTags?.includes("no-kneel") && cat === "D") return false;
  if (opts.prop?.conflictTags?.includes("no-jump") && (cat === "H" || cat === "L")) return false;
  return true;
}

export function pickModelShotPoses(opts: {
  pool: EcomPoseLibraryEntry[];
  styles: string[];
  count: number;
  prop?: EcomPropLibraryEntry | null;
  scene?: EcomSceneLibraryEntry | null;
}): EcomPoseLibraryEntry[] {
  const style = resolveStyle(opts.styles);
  const sceneArchetype = resolveSceneArchetype(opts.scene);
  const count = Math.max(6, Math.min(8, opts.count));
  const priorityCats = mergeStyleScenePriority(PRIORITY[style], sceneArchetype);
  const picked: EcomPoseLibraryEntry[] = [];
  const usedIds = new Set<string>();

  const platformPool = opts.pool.filter((p) => p.enabled !== false);
  const candidates = shuffle(
    platformPool.filter((p) =>
      passesVeto({ pose: p, style, prop: opts.prop, sceneArchetype }),
    ),
  );

  for (const cat of priorityCats) {
    if (picked.length >= count) break;
    const match = candidates.find((p) => p.category === cat && !usedIds.has(p.id));
    if (match) {
      picked.push(match);
      usedIds.add(match.id);
    }
  }

  for (const p of candidates) {
    if (picked.length >= count) break;
    if (usedIds.has(p.id)) continue;
    picked.push(p);
    usedIds.add(p.id);
  }

  while (picked.length < count) {
    const extra = candidates.find((p) => !usedIds.has(p.id));
    if (!extra) break;
    picked.push(extra);
    usedIds.add(extra.id);
  }

  return picked.slice(0, count);
}

export function posesToPromptTexts(opts: {
  poses: EcomPoseLibraryEntry[];
  styles: string[];
}): string[] {
  const style = resolveStyle(opts.styles);
  return opts.poses.map((p) => applyStyleMicroAdjust(p.baseDescription, style));
}
