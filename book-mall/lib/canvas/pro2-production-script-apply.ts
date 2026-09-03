/**
 * Pro2 制作包 · JSON patch merge → Hub productionScript / *Md / scriptStudio*Rows
 */
import type { Pro2ProductionScriptStep } from "./data/pro2-production-script-schema";
import { mergeProductionScriptPatch } from "./data/pro2-production-script-schema";
import {
  PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
  type Pro2ProductionScript,
  type Pro2ProductionScriptPatch,
} from "./data/pro2-production-script-schema";
import {
  enrichStoryboardMdShotFields,
  renderHubOutlineDisplayMd,
  renderProductionScriptCharacterMd,
  renderProductionScriptSceneMd,
  renderProductionScriptStoryboardMd,
} from "./pro2-production-script-render-md";
import {
  extractPro2ProductionScriptPatch,
  extractPro2HumanProductionPackPrefix,
  hasHumanReadableProductionPackSections,
  isUnparsedPro2ProductionJsonBlob,
  parsePro2ProductionScriptEnvelope,
  pro2PatchStepMatchesSection,
} from "./pro2-production-script-structured";
import {
  convertPro2HumanTabMarkdownToGfm,
  extractCharacterSectionFromOutline,
  extractPro2HumanStoryboardMd,
  normalizeStoryboardSectionFromOutline,
  parseCharacterRows,
  parseSceneVisualDictionaryRows,
  parseStoryboardRows,
  storyboardMdHasParseableRows,
  type StoryboardTableRow,
} from "./parse-md-tables";
import {
  pro2PlaceholderSlug,
  stripPro2AnchorPlaceholders,
} from "./pro2-chinese-prompt-normalize";
import { reconcileProductionScriptEntityLinks } from "./pro2-shot-entity-reconcile";
import { isPro2JsonOnlyHubData } from "./pro2-project-format";
import {
  characterAppearanceNeedsStructuredCoerce,
  enrichPro2CharacterRecordForParse,
} from "./pro2-character-script-fields";
import { syncStoryProColumnRows } from "./story-pro-column-sync";
import type { StoryProVisualStylePack } from "./story-pro-visual-style-pack";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { StoryLlmSection } from "./story-workspace-types";
import { pushStoryRevision } from "./story-revision";

function visualStyleToPack(
  script: import("./data/pro2-production-script-schema").Pro2ProductionScript,
): StoryProVisualStylePack | undefined {
  const vs = script.visualStyle;
  if (!vs) return undefined;
  const dayParts = [
    vs.dayPalette?.primary,
    vs.dayPalette?.highlight,
    vs.dayPalette?.shadow,
  ]
    .filter(Boolean)
    .join(" / ");
  const nightParts = [
    vs.nightPalette?.primary,
    vs.nightPalette?.highlight,
    vs.nightPalette?.shadow,
  ]
    .filter(Boolean)
    .join(" / ");
  const colorPalette = [vs.globalColorTone, dayParts && `日景：${dayParts}`, nightParts && `夜景：${nightParts}`]
    .filter(Boolean)
    .join("；");
  return {
    worldBackground: vs.worldBackground,
    era: vs.era,
    visualStyle: vs.pictureStyle,
    colorPalette: colorPalette || undefined,
    lighting: vs.lighting ?? vs.cinematography,
    styleAnchorZh: vs.styleAnchor,
    styleAnchorEn: vs.styleAnchor,
  };
}

function productionScriptToHubRows(
  hubData: StoryProScriptHubNodeData,
  scriptHubId?: string,
): Partial<StoryProScriptHubNodeData> {
  const synced = syncStoryProColumnRows(
    hubData,
    {
      characterRows: hubData.scriptStudioCharacterRows,
      sceneRows: hubData.sceneRows,
      frameRows: hubData.scriptStudioFrameRows,
    },
    scriptHubId,
  );
  const props =
    hubData.productionScript?.props?.map((p) => ({
      key: p.id,
      name: p.name,
      description: p.description ?? "",
      prompt: p.imagePrompt ?? "",
    })) ?? hubData.scriptStudioPropRows;
  const moods =
    hubData.productionScript?.moods?.map((m) => ({
      key: m.id,
      name: m.name,
      description: m.description ?? "",
      prompt: "",
    })) ?? hubData.scriptStudioMoodRows;
  const audios =
    hubData.productionScript?.audios?.map((a) => ({
      key: a.id,
      name: a.name,
      description: a.description ?? "",
      prompt: a.description?.trim() ?? "",
      frameKey: a.frameIndex != null ? String(a.frameIndex) : undefined,
    })) ?? hubData.scriptStudioAudioRows;

  return {
    scriptStudioCharacterRows: synced.characterRows,
    sceneRows: synced.sceneRows,
    scriptStudioFrameRows: synced.frameRows,
    scriptStudioPropRows: props,
    scriptStudioMoodRows: moods,
    scriptStudioAudioRows: audios,
  };
}

/** 将已校验 patch 写入 hub（不含 runtime / history） */
export function applyProductionScriptPatchToHub(
  data: StoryProScriptHubNodeData,
  envelope: Pro2ProductionScriptPatch,
  scriptHubId?: string,
  sourceText?: string,
): Partial<StoryProScriptHubNodeData> {
  const productionScript = reconcileProductionScriptEntityLinks(
    mergeProductionScriptPatch(data.productionScript, envelope),
  );
  const mergedHub: StoryProScriptHubNodeData = {
    ...data,
    productionScript,
  };

  const patch: Partial<StoryProScriptHubNodeData> = { productionScript };

  const { step } = envelope;

  if (step === "full_pack" || step === "outline") {
    const outlineMd = renderHubOutlineDisplayMd(productionScript);
    if (outlineMd.trim()) {
      patch.outlineMd = outlineMd;
      patch.outlineHistory = pushStoryRevision(data.outlineHistory, outlineMd);
      const stylePack = visualStyleToPack(productionScript);
      if (stylePack) patch.visualStylePack = stylePack;
    }
  }

  if (step === "full_pack" || step === "character") {
    const characterMd = renderProductionScriptCharacterMd(productionScript);
    if (characterMd.trim()) {
      patch.characterMd = characterMd;
      patch.characterHistory = pushStoryRevision(
        data.characterHistory,
        characterMd,
      );
    }
  }

  if (step === "full_pack" || step === "scene") {
    const sceneMd = renderProductionScriptSceneMd(productionScript);
    if (sceneMd.trim()) {
      patch.sceneMd = sceneMd;
      patch.sceneHistory = pushStoryRevision(data.sceneHistory, sceneMd);
    }
  }

  if (step === "full_pack" || step === "storyboard") {
    const jsonStoryboard = renderProductionScriptStoryboardMd(productionScript);
    const storyboardMd = enrichStoryboardMdShotFields(
      jsonStoryboard,
      undefined,
      productionScript,
    );
    if (storyboardMd.trim()) {
      patch.storyboardMd = storyboardMd;
      patch.storyboardHistory = pushStoryRevision(
        data.storyboardHistory,
        storyboardMd,
      );
    }
  }

  if (step === "shot_prompts") {
    const jsonStoryboard = renderProductionScriptStoryboardMd(productionScript);
    const storyboardMd = enrichStoryboardMdShotFields(
      jsonStoryboard,
      data.storyboardMd?.trim() || undefined,
      productionScript,
    );
    if (storyboardMd.trim()) {
      patch.storyboardMd = storyboardMd;
      patch.storyboardHistory = pushStoryRevision(
        data.storyboardHistory,
        storyboardMd,
      );
    }
  }

  const hubForRows: StoryProScriptHubNodeData = {
    ...mergedHub,
    ...patch,
  };

  let finalScript = (patch.productionScript ?? productionScript) as Pro2ProductionScript;
  const enrichedShots = enrichProductionScriptShotsFromSources(finalScript, hubForRows);
  if ((enrichedShots.shots?.length ?? 0) > (finalScript.shots?.length ?? 0)) {
    finalScript = enrichedShots;
    patch.productionScript = finalScript;
    hubForRows.productionScript = finalScript;
    const jsonStoryboard = renderProductionScriptStoryboardMd(finalScript);
    const storyboardMd = enrichStoryboardMdShotFields(
      jsonStoryboard,
      hubForRows.storyboardMd || data.storyboardMd,
      finalScript,
    );
    if (storyboardMd.trim()) {
      patch.storyboardMd = storyboardMd;
      patch.storyboardHistory = pushStoryRevision(
        data.storyboardHistory,
        storyboardMd,
      );
      hubForRows.storyboardMd = storyboardMd;
    }
  }

  Object.assign(patch, productionScriptToHubRows(hubForRows, scriptHubId));

  return patch;
}

/** Hub 可视化编辑 · 整包 productionScript 写回 *Md 与 rows */
export function applyProductionScriptDirectToHub(
  data: StoryProScriptHubNodeData,
  productionScript: import("./data/pro2-production-script-schema").Pro2ProductionScript,
  scriptHubId?: string,
): Partial<StoryProScriptHubNodeData> {
  const envelope: Pro2ProductionScriptPatch = {
    schemaVersion: 1,
    tier: "pro",
    step: "full_pack",
    patch: {
      meta: productionScript.meta,
      visualStyle: productionScript.visualStyle,
      coreConflict: productionScript.coreConflict,
      scenes: productionScript.scenes,
      characters: productionScript.characters,
      shots: productionScript.shots,
      handoff: productionScript.handoff,
      props: productionScript.props,
      moods: productionScript.moods,
      audios: productionScript.audios,
    },
  };
  return applyProductionScriptPatchToHub(
    data,
    envelope,
    scriptHubId,
    data.outlineRuntime?.textOutput ?? data.outlineMd ?? "",
  );
}

/** 尝试 JSON 围栏 apply；不匹配或失败返回 null（调用方走 MD 回退） */
export function tryApplyStructuredProductionScript(
  data: StoryProScriptHubNodeData,
  section: StoryLlmSection,
  textOutput: string,
  scriptHubId?: string,
): Partial<StoryProScriptHubNodeData> | null {
  const envelope = extractPro2ProductionScriptPatch(textOutput);
  if (!envelope) return null;
  if (!pro2PatchStepMatchesSection(envelope.step, section)) return null;
  return applyProductionScriptPatchToHub(data, envelope, scriptHubId, textOutput);
}

function isLenientStoredProductionScript(
  stored: Pro2ProductionScript,
): boolean {
  return (stored.shots ?? []).some((s) =>
    String(s.sceneDescription ?? "").trim(),
  );
}

function storedScriptHasAnchorPlaceholders(
  stored: Pro2ProductionScript,
): boolean {
  const tagged = (t?: string) => String(t ?? "").includes("<<<");
  if (stored.characters?.some((c) => tagged(c.name) || tagged(c.role))) {
    return true;
  }
  if (stored.scenes?.some((s) => tagged(s.name))) return true;
  if (
    stored.shots?.some(
      (s) =>
        tagged(s.sceneDescription) ||
        s.propIds?.some((id) => tagged(String(id))),
    )
  ) {
    return true;
  }
  return false;
}

function reapplyStoredProductionScript(
  data: StoryProScriptHubNodeData,
  stored: Pro2ProductionScript,
  scriptHubId?: string,
): Partial<StoryProScriptHubNodeData> | null {
  const step = inferStoredScriptStep(stored);
  const envelope = parsePro2ProductionScriptEnvelope({
    schemaVersion: stored.schemaVersion ?? PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    tier: "pro",
    step,
    patch: {
      meta: stored.meta,
      visualStyle: stored.visualStyle,
      coreConflict: stored.coreConflict,
      scenes: stored.scenes,
      characters: stored.characters,
      shots: stored.shots,
      handoff: stored.handoff,
      props: stored.props,
      moods: stored.moods,
      audios: stored.audios,
    },
  });
  if (!envelope.ok) return null;
  const sourceText =
    data.outlineRuntime?.textOutput ??
    data.storyboardRuntime?.textOutput ??
    data.outlineMd ??
    data.storyboardMd ??
    "";
  return applyProductionScriptPatchToHub(
    data,
    envelope.patch,
    scriptHubId,
    sourceText,
  );
}

/** hydrate / 打开编辑：从误落库的 raw JSON 或 runtime textOutput 恢复 productionScript 与各 Tab */
export function tryRepairHubFromStoredProductionJson(
  data: StoryProScriptHubNodeData,
  scriptHubId?: string,
): Partial<StoryProScriptHubNodeData> | null {
  const stored = data.productionScript;
  if (stored && storedScriptHasAnchorPlaceholders(stored)) {
    const repaired = reapplyStoredProductionScript(data, stored, scriptHubId);
    if (repaired) return repaired;
  }
  if (
    stored &&
    (stored.characters ?? []).some((c) =>
      characterAppearanceNeedsStructuredCoerce(c.appearance),
    )
  ) {
    const repaired = reapplyStoredProductionScript(data, stored, scriptHubId);
    if (repaired) return repaired;
  }
  if (
    stored &&
    (stored.characters?.length ?? 0) > 0 &&
    !(stored.shots?.length ?? 0)
  ) {
    const resolved = resolveHubProductionScript(data);
    if ((resolved?.shots?.length ?? 0) > 0) {
      return { productionScript: resolved! };
    }
    const reapply = reapplyStoredProductionScript(data, stored, scriptHubId);
    if ((reapply?.productionScript?.shots?.length ?? 0) > 0) return reapply;
  }

  const outlineBlob = isUnparsedPro2ProductionJsonBlob(data.outlineMd ?? "");
  const storyboardBlob = isUnparsedPro2ProductionJsonBlob(data.storyboardMd ?? "");
  const hasStructured =
    Boolean(stored?.visualStyle?.worldBackground?.trim()) ||
    Boolean(stored?.shots?.length) ||
    Boolean(stored?.characters?.length);

  const sources = [
    data.outlineRuntime?.textOutput,
    data.outlineMd,
    data.storyboardRuntime?.textOutput,
    data.storyboardMd,
    data.characterRuntime?.textOutput,
  ];

  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const humanGfm = convertPro2HumanTabMarkdownToGfm(
      extractPro2HumanProductionPackPrefix(raw),
    );
    if (!hasHumanReadableProductionPackSections(humanGfm)) continue;
    const humanStoryboard = extractPro2HumanStoryboardMd(humanGfm);
    const storedStoryboard = data.storyboardMd ?? "";
    const humanRows = parseStoryboardRows(humanStoryboard);
    const storedRows = parseStoryboardRows(storedStoryboard);
    const humanHasPropNames = humanRows.some(
      (r) =>
        r.propNames?.trim() &&
        r.propNames !== "—" &&
        !r.propNames.includes("<<<prop_"),
    );
    const storedHasPropNames = storedRows.some(
      (r) =>
        r.propNames?.trim() &&
        r.propNames !== "—" &&
        !r.propNames.includes("<<<prop_"),
    );
    const needsHumanStoryboardRepair =
      storyboardMdHasParseableRows(humanStoryboard) &&
      (!storyboardMdHasParseableRows(storedStoryboard) ||
        humanRows.length > storedRows.length ||
        (humanHasPropNames && !storedHasPropNames));
    const envelope = extractPro2ProductionScriptPatch(raw);
    if (!envelope) continue;
    const needsShotsRepair =
      (stored?.shots?.length ?? 0) === 0 &&
      (envelope.patch.shots?.length ?? 0) > 0;
    if (!needsHumanStoryboardRepair && !needsShotsRepair) {
      continue;
    }
    return applyProductionScriptPatchToHub(data, envelope, scriptHubId, raw);
  }

  const shotsMissing = !(stored?.shots?.length ?? 0);
  if (!outlineBlob && !storyboardBlob && hasStructured && !shotsMissing) return null;

  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const envelope = extractPro2ProductionScriptPatch(raw);
    if (!envelope) continue;
    return applyProductionScriptPatchToHub(data, envelope, scriptHubId, raw);
  }
  return trySyncResolvedProductionScriptToHub(data);
}

/** 结构化 Tab / spawn 用 · 是否有可展示的 productionScript 内容 */
export function productionScriptHasDisplayContent(
  script?: Pro2ProductionScript | null,
): boolean {
  if (!script) return false;
  return Boolean(
    script.visualStyle?.worldBackground?.trim() ||
      (script.scenes?.length ?? 0) > 0 ||
      (script.characters?.length ?? 0) > 0 ||
      (script.shots?.length ?? 0) > 0,
  );
}

function productionScriptShotsNeedSync(
  stored?: Pro2ProductionScript | null,
  resolved?: Pro2ProductionScript | null,
): boolean {
  if ((resolved?.shots?.length ?? 0) > (stored?.shots?.length ?? 0)) {
    return true;
  }
  if (!(stored?.shots?.length ?? 0) || !(resolved?.shots?.length ?? 0)) {
    return false;
  }
  const isEmptyCell = (value?: string) => {
    const t = value?.trim();
    return !t || t === "—";
  };
  const resolvedByIndex = new Map(resolved!.shots!.map((s) => [s.index, s]));
  return stored!.shots!.some((shot) => {
    const next = resolvedByIndex.get(shot.index);
    if (!next) return true;
    return (
      (!(shot.propIds?.length) && (next.propIds?.length ?? 0) > 0) ||
      (isEmptyCell(shot.sfxNote) && !isEmptyCell(next.sfxNote)) ||
      (isEmptyCell(shot.audioNote) && !isEmptyCell(next.audioNote))
    );
  });
}

function parseStoryboardDurationSec(raw: string | undefined): number | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const n = parseFloat(t.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function resolvePropNamesToIds(
  propNames: string,
  script: Pro2ProductionScript,
): string[] {
  const t = propNames.trim();
  if (!t || t === "—") return [];
  const parts = t.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [];
  return parts
    .map((name) => {
      const stripped = stripPro2AnchorPlaceholders(name);
      const slug = pro2PlaceholderSlug(name);
      const byCatalog = script.props?.find(
        (p) =>
          p.id === name ||
          p.id === slug ||
          p.id === name.replace(/_/g, "-") ||
          p.name === name ||
          p.name === stripped,
      );
      if (byCatalog) return byCatalog.id;
      if (/^prop[-_]/i.test(slug) || name.includes("<<<prop_")) return slug;
      return "";
    })
    .filter(Boolean);
}

function resolveSceneIdFromStoryboardRow(
  row: StoryboardTableRow,
  script: Pro2ProductionScript,
): string | undefined {
  const sceneHint = row.scene?.trim();
  if (sceneHint) {
    const match = script.scenes?.find(
      (s) =>
        s.name === sceneHint ||
        sceneHint.includes(s.name) ||
        s.name.includes(sceneHint),
    );
    if (match) return match.id;
  }
  const desc = row.description ?? "";
  for (const scene of script.scenes ?? []) {
    if (desc.includes(scene.name)) return scene.id;
  }
  return undefined;
}

/** 人读分镜表 → shots[]（JSON shots 缺失时的回落） */
function buildProductionScriptShotsFromHumanStoryboard(
  script: Pro2ProductionScript,
  raw: string,
): Pro2ProductionScript["shots"] {
  const humanGfm = convertPro2HumanTabMarkdownToGfm(
    extractPro2HumanProductionPackPrefix(raw),
  );
  const storyboardMd =
    extractPro2HumanStoryboardMd(humanGfm) ||
    normalizeStoryboardSectionFromOutline(humanGfm);
  if (!storyboardMdHasParseableRows(storyboardMd)) return undefined;
  const rows = parseStoryboardRows(storyboardMd);
  if (!rows.length) return undefined;
  return rows.map((row) => ({
    index: row.frameIndex,
    shotSize: row.shotSize || undefined,
    cameraMove: row.cameraMove || undefined,
    sceneDescription: row.description?.trim() || `镜号 ${row.frameIndex}`,
    dialogue: row.dialogue?.trim() || "—",
    durationSec: parseStoryboardDurationSec(row.duration),
    lighting: row.lighting || undefined,
    sfxNote: row.sfxNote || undefined,
    audioNote: row.lipSyncNote || "",
    frameImagePrompt: row.frameImagePrompt || row.aiImagePrompt || undefined,
    videoPrompt: row.videoPrompt || row.aiVideoPrompt || undefined,
    propIds: resolvePropNamesToIds(row.propNames ?? "", script),
    sceneId: resolveSceneIdFromStoryboardRow(row, script),
  }));
}

/** 已落库 productionScript 缺 shots 时，从 runtime / 人读分镜表补全；并回填 propIds / 音效 / 口型 */
function mergeShotDirectorFieldsFromFallback(
  script: Pro2ProductionScript,
  fallbackShots: NonNullable<Pro2ProductionScript["shots"]>,
): Pro2ProductionScript | null {
  const isEmptyCell = (value?: string) => {
    const t = value?.trim();
    return !t || t === "—";
  };
  const byIndex = new Map(fallbackShots.map((s) => [s.index, s]));
  let changed = false;
  const shots = script.shots!.map((shot) => {
    const fb = byIndex.get(shot.index);
    if (!fb) return shot;
    let next = { ...shot };
    if (!(next.propIds?.length) && fb.propIds?.length) {
      next.propIds = fb.propIds;
      changed = true;
    }
    if (!(next.sceneId?.trim()) && fb.sceneId?.trim()) {
      next.sceneId = fb.sceneId.trim();
      changed = true;
    }
    if (isEmptyCell(next.sfxNote) && !isEmptyCell(fb.sfxNote)) {
      next.sfxNote = fb.sfxNote!.trim();
      changed = true;
    }
    if (isEmptyCell(next.audioNote) && !isEmptyCell(fb.audioNote)) {
      next.audioNote = fb.audioNote!.trim();
      changed = true;
    }
    return next;
  });
  return changed ? { ...script, shots } : null;
}

function enrichProductionScriptShotsDirectorFields(
  script: Pro2ProductionScript,
  data: StoryProScriptHubNodeData,
): Pro2ProductionScript {
  if (!(script.shots?.length ?? 0)) return script;
  const isEmptyCell = (value?: string) => {
    const t = value?.trim();
    return !t || t === "—";
  };
  const needsEnrich = script.shots!.some(
    (s) =>
      !(s.propIds?.length) ||
      (!(s.sceneId?.trim()) && (script.scenes?.length ?? 0) > 0) ||
      isEmptyCell(s.sfxNote) ||
      isEmptyCell(s.audioNote),
  );
  let result = script;
  if (needsEnrich) {
    const sources = [
      data.outlineRuntime?.textOutput,
      data.storyboardRuntime?.textOutput,
      data.outlineMd,
      data.storyboardMd,
    ];
    for (const raw of sources) {
      if (!raw?.trim()) continue;

      const envelope = extractPro2ProductionScriptPatch(raw);
      if (envelope?.patch.shots?.length) {
        const merged = mergeProductionScriptPatch(result, envelope);
        const fromJson = mergeShotDirectorFieldsFromFallback(
          result,
          merged.shots ?? [],
        );
        if (fromJson) result = fromJson;
      }

      const fromHuman = buildProductionScriptShotsFromHumanStoryboard(result, raw);
      if (fromHuman?.length) {
        const merged = mergeShotDirectorFieldsFromFallback(result, fromHuman);
        if (merged) result = merged;
      }
    }
  }
  return reconcileProductionScriptEntityLinks(result);
}

/** 已落库 productionScript 缺 shots 时，从 runtime / 人读分镜表补全 */
function enrichProductionScriptShotsFromSources(
  script: Pro2ProductionScript,
  data: StoryProScriptHubNodeData,
): Pro2ProductionScript {
  let result = script;
  if (!(script.shots?.length ?? 0)) {
    const sources = [
      data.outlineRuntime?.textOutput,
      data.storyboardRuntime?.textOutput,
      data.outlineMd,
      data.storyboardMd,
      data.characterRuntime?.textOutput,
    ];

    for (const raw of sources) {
      if (!raw?.trim()) continue;
      const envelope = extractPro2ProductionScriptPatch(raw);
      if (envelope?.patch.shots?.length) {
        result = mergeProductionScriptPatch(script, envelope);
        break;
      }
    }

    if (!(result.shots?.length ?? 0)) {
      for (const raw of sources) {
        if (!raw?.trim()) continue;
        const fromHuman = buildProductionScriptShotsFromHumanStoryboard(script, raw);
        if (fromHuman?.length) {
          result = {
            ...script,
            schemaVersion:
              script.schemaVersion ?? PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
            shots: fromHuman,
          };
          break;
        }
      }
    }
  }

  return enrichProductionScriptShotsDirectorFields(result, data);
}

/** runtime 已从 textOutput 解析出 JSON，但 hub.productionScript 未落库时补写（不覆盖 *Md） */
export function trySyncResolvedProductionScriptToHub(
  data: StoryProScriptHubNodeData,
): Partial<StoryProScriptHubNodeData> | null {
  const resolved = resolveHubProductionScript(data);
  if (!productionScriptHasDisplayContent(resolved)) return null;

  const stored = data.productionScript;
  if (
    stored &&
    productionScriptHasDisplayContent(stored) &&
    !(stored.shots?.length ?? 0) &&
    (resolved?.shots?.length ?? 0) > 0
  ) {
    return { productionScript: resolved! };
  }
  if (!productionScriptHasDisplayContent(stored)) {
    return { productionScript: resolved! };
  }
  if (productionScriptShotsNeedSync(stored, resolved)) {
    return { productionScript: resolved! };
  }
  return null;
}

function inferStoredScriptStep(
  stored: Pro2ProductionScript,
): Pro2ProductionScriptStep {
  const hasChars = (stored.characters?.length ?? 0) > 0;
  const hasShots = (stored.shots?.length ?? 0) > 0;
  const hasHandoff = (stored.handoff?.length ?? 0) > 0;
  if (hasChars && hasShots && hasHandoff) return "full_pack";
  if (hasShots) return "storyboard";
  if (hasChars) return "character";
  if ((stored.scenes?.length ?? 0) > 0) return "scene";
  return "outline";
}

function isStrictStoredProductionScript(
  stored: Pro2ProductionScript,
): boolean {
  const step = inferStoredScriptStep(stored);
  const schemaVersion =
    stored.schemaVersion ?? PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION;
  const envelope = parsePro2ProductionScriptEnvelope({
    schemaVersion,
    tier: "pro",
    step,
    patch: {
      meta: stored.meta,
      visualStyle: stored.visualStyle,
      coreConflict: stored.coreConflict,
      scenes: stored.scenes,
      characters: stored.characters,
      shots: stored.shots,
      handoff: stored.handoff,
      props: stored.props,
      moods: stored.moods,
      audios: stored.audios,
    },
  });
  return envelope.ok;
}

/** 从已解析 GFM Tab 补建 productionScript（JSON 围栏失败时的兜底） */
function buildProductionScriptPatchFromHubMarkdown(
  data: StoryProScriptHubNodeData,
): Pro2ProductionScriptPatch | null {
  const characterSource =
    data.characterMd?.trim() ||
    extractCharacterSectionFromOutline(data.outlineMd ?? "");
  const sceneSource = data.sceneMd?.trim() || "";
  const charRows = parseCharacterRows(characterSource);
  const sceneRows = parseSceneVisualDictionaryRows(sceneSource);
  if (!charRows.length && !sceneRows.length) return null;

  const patch: Pro2ProductionScriptPatch["patch"] = {};
  if (charRows.length) {
    patch.characters = charRows.map((c) => {
      const enriched = enrichPro2CharacterRecordForParse({
        id: pro2PlaceholderSlug(c.name),
        name: c.name,
        role: c.role || "—",
        appearance: c.appearance,
        personality: c.personality || "—",
        imagePrompt: c.aiImagePrompt?.trim() || c.appearance,
      });
      return enriched as Pro2ProductionScriptPatch["patch"]["characters"] extends (infer T)[]
        ? T
        : never;
    });
  }
  if (sceneRows.length) {
    patch.scenes = sceneRows.map((s) => ({
      id: pro2PlaceholderSlug(s.name),
      name: stripPro2AnchorPlaceholders(s.name),
      environmentTimeMood: s.envTimeMood?.trim() || s.name,
      imagePrompt: s.imageKeywords?.trim() || s.name,
      negativePrompt: s.negativePrompt?.trim() || "—",
    }));
  }

  return {
    schemaVersion: PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
    tier: "pro",
    step: patch.characters?.length && !patch.scenes?.length ? "character" : "outline",
    patch,
  };
}

/** 运行时解析：优先已落库且通过严格校验的 productionScript，否则从 raw JSON 推断 */
export function resolveHubProductionScript(
  data: StoryProScriptHubNodeData,
): Pro2ProductionScript | null {
  const stored = data.productionScript;
  const outlineBlob = isUnparsedPro2ProductionJsonBlob(data.outlineMd ?? "");
  const storyboardBlob = isUnparsedPro2ProductionJsonBlob(data.storyboardMd ?? "");
  const storedStrictUsable =
    stored &&
    isStrictStoredProductionScript(stored) &&
    (stored.visualStyle?.worldBackground?.trim() ||
      (stored.shots?.length ?? 0) > 0 ||
      (stored.characters?.length ?? 0) > 0 ||
      (stored.scenes?.length ?? 0) > 0);
  const finish = (
    script: Pro2ProductionScript | null,
  ): Pro2ProductionScript | null => {
    if (!script) return null;
    return enrichProductionScriptShotsFromSources(script, data);
  };

  if (storedStrictUsable && !outlineBlob && !storyboardBlob) return finish(stored);

  const storedLenientUsable =
    stored &&
    isLenientStoredProductionScript(stored) &&
    (stored.visualStyle?.worldBackground?.trim() ||
      (stored.characters?.length ?? 0) > 0 ||
      (stored.scenes?.length ?? 0) > 0);

  const sources = [
    data.outlineMd,
    data.storyboardMd,
    data.outlineRuntime?.textOutput,
    data.characterRuntime?.textOutput,
    data.storyboardRuntime?.textOutput,
  ];
  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const envelope = extractPro2ProductionScriptPatch(raw);
    if (!envelope) continue;
    return finish(mergeProductionScriptPatch(stored, envelope));
  }
  if (!isPro2JsonOnlyHubData(data)) {
    const fromMd = buildProductionScriptPatchFromHubMarkdown(data);
    if (fromMd) {
      return finish(mergeProductionScriptPatch(stored, fromMd));
    }
  }
  if (storedStrictUsable) return finish(stored!);
  if (storedLenientUsable) return finish(stored!);
  return finish(stored ?? null);
}

export function hubHasStructuredProductionScript(
  data: StoryProScriptHubNodeData,
): boolean {
  return resolveHubProductionScript(data) != null;
}
