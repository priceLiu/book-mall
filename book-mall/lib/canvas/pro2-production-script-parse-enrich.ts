/**
 * Pro2 制作包 · LLM 解析前系统补全（不编造剧情，只补关联 ID / 生图 prompt 字面量块）
 * canvas-web/lib/canvas/pro2-production-script-parse-enrich.ts 须保持同步
 */
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";
import {
  buildPro2CharacterVisualStyleTag,
  finalizePro2PropImageDockPrompt,
  finalizePro2SceneImageDockPrompt,
  type Pro2CharacterDockVisualStyleInput,
} from "./pro2-production-pack-prompt";
import { reconcileProductionScriptEntityLinks } from "./pro2-shot-entity-reconcile";
import { enrichPro2CharacterRecordForParse } from "./pro2-character-script-fields";

function visualStylePackFromPatch(
  visualStyle: unknown,
): Pro2CharacterDockVisualStyleInput | null {
  if (!visualStyle || typeof visualStyle !== "object" || Array.isArray(visualStyle)) {
    return null;
  }
  const v = visualStyle as Record<string, unknown>;
  return {
    era: String(v.era ?? "").trim() || undefined,
    worldBackground: String(v.worldBackground ?? "").trim() || undefined,
    visualStyle: String(v.pictureStyle ?? v.globalColorTone ?? "").trim() || undefined,
    styleAnchorZh: String(v.styleAnchor ?? "").trim() || undefined,
  };
}

function ensureAssetNamePrefix(name: string, prompt: string): string {
  const n = name.trim();
  const p = prompt.trim();
  if (!n) return p;
  if (/名称：/.test(p)) return p;
  if (!p) return `名称：${n}`;
  return `名称：${n}。${p}`;
}

/** scenes[] · 补「构图规范」与 [视觉风格：…]（沿用 Dock 金标准全文） */
export function enrichPro2SceneRecordForParse(
  raw: Record<string, unknown>,
  visualStylePack?: Pro2CharacterDockVisualStyleInput | null,
): Record<string, unknown> {
  const out = { ...raw };
  const name = String(out.name ?? "").trim();
  let prompt = String(out.imagePrompt ?? out.prompt ?? "").trim();
  if (!prompt && name) {
    const env = String(out.environmentTimeMood ?? "").trim();
    const desc = String(out.description ?? "").trim();
    prompt = [
      `名称：${name}${env ? `，${env}` : ""}`,
      desc ? `描述：${desc}` : "",
      String(out.foreground ?? "").trim()
        ? `前背景：${String(out.foreground).trim()}`
        : "",
      String(out.atmosphere ?? "").trim()
        ? `氛围：${String(out.atmosphere).trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("。");
  } else if (name) {
    prompt = ensureAssetNamePrefix(name, prompt);
  }
  if (prompt) {
    out.imagePrompt = finalizePro2SceneImageDockPrompt(prompt, {
      visualStylePack,
      visualStyleTag: String(out.visualStyleTag ?? ""),
    });
  }
  return out;
}

/** props[] · 补「构图规范」与 [视觉风格：…] */
export function enrichPro2PropRecordForParse(
  raw: Record<string, unknown>,
  visualStylePack?: Pro2CharacterDockVisualStyleInput | null,
): Record<string, unknown> {
  const out = { ...raw };
  const name = String(out.name ?? "").trim();
  let prompt = String(out.imagePrompt ?? out.prompt ?? "").trim();
  if (!prompt && name) {
    const desc = String(out.description ?? "").trim();
    const traits = String(out.traits ?? "").trim();
    prompt = [
      `名称：${name}`,
      desc ? `描述：${desc}` : "",
      traits ? `特征：${traits}` : "",
    ]
      .filter(Boolean)
      .join("。");
  } else if (name) {
    prompt = ensureAssetNamePrefix(name, prompt);
  }
  if (prompt) {
    out.imagePrompt = finalizePro2PropImageDockPrompt(prompt, {
      visualStylePack,
      visualStyleTag: String(out.visualStyleTag ?? ""),
    });
  }
  return out;
}

/** shots[] · 从对白/画面描述推断 characterIds / propIds / sceneId（校验前） */
export function coercePro2PatchEntityLinksForParse(
  patch: Record<string, unknown>,
): void {
  const shots = patch.shots;
  if (!Array.isArray(shots) || shots.length === 0) return;
  const script = {
    meta: patch.meta,
    visualStyle: patch.visualStyle,
    coreConflict: patch.coreConflict,
    scenes: patch.scenes,
    characters: patch.characters,
    props: patch.props,
    shots: shots.map((s) =>
      s && typeof s === "object" && !Array.isArray(s) ? { ...(s as object) } : s,
    ),
    handoff: patch.handoff,
  } as Pro2ProductionScript;
  const reconciled = reconcileProductionScriptEntityLinks(script);
  if (reconciled.shots?.length) {
    patch.shots = reconciled.shots;
  }
}

export function enrichPro2ProductionScriptPatchForParse(
  patch: Record<string, unknown>,
): void {
  const visualStylePack = visualStylePackFromPatch(patch.visualStyle);

  if (Array.isArray(patch.characters)) {
    patch.characters = patch.characters.map((row) =>
      row && typeof row === "object" && !Array.isArray(row)
        ? enrichPro2CharacterRecordForParse(row as Record<string, unknown>, {
            visualStylePack,
          })
        : row,
    );
  }
  if (Array.isArray(patch.scenes)) {
    patch.scenes = patch.scenes.map((row) =>
      row && typeof row === "object" && !Array.isArray(row)
        ? enrichPro2SceneRecordForParse(row as Record<string, unknown>, visualStylePack)
        : row,
    );
  }
  if (Array.isArray(patch.props)) {
    patch.props = patch.props.map((row) =>
      row && typeof row === "object" && !Array.isArray(row)
        ? enrichPro2PropRecordForParse(row as Record<string, unknown>, visualStylePack)
        : row,
    );
  }

  coercePro2PatchEntityLinksForParse(patch);
}

/** 从 patch.visualStyle 生成兜底 [视觉风格：…]（供测试或单行补 tag） */
export function buildPro2ParseVisualStyleTagFromPatch(
  visualStyle: unknown,
): string | undefined {
  return buildPro2CharacterVisualStyleTag(visualStylePackFromPatch(visualStyle));
}
