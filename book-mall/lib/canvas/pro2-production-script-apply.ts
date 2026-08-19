/**
 * Pro2 制作包 · JSON patch merge → Hub productionScript / *Md / scriptStudio*Rows
 */
import type { Pro2ProductionScriptStep } from "./data/pro2-production-script-schema";
import { mergeProductionScriptPatch } from "./data/pro2-production-script-schema";
import {
  PRO2_PRODUCTION_SCRIPT_SCHEMA_VERSION,
  type Pro2ProductionScript,
} from "./data/pro2-production-script-schema";
import {
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
  extractPro2HumanStoryboardMd,
  normalizeStoryboardSectionFromOutline,
  promotePro2HumanGfmToHubFields,
  parseStoryboardRows,
  storyboardMdHasParseableRows,
} from "./parse-md-tables";
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
      prompt: "",
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
  const productionScript = mergeProductionScriptPatch(
    data.productionScript,
    envelope,
  );
  const mergedHub: StoryProScriptHubNodeData = {
    ...data,
    productionScript,
  };

  const patch: Partial<StoryProScriptHubNodeData> = { productionScript };

  const { step } = envelope;

  const humanGfm = sourceText?.trim()
    ? convertPro2HumanTabMarkdownToGfm(
        extractPro2HumanProductionPackPrefix(sourceText),
      )
    : "";
  const humanFields =
    humanGfm && hasHumanReadableProductionPackSections(humanGfm)
      ? promotePro2HumanGfmToHubFields(humanGfm)
      : null;

  if (step === "full_pack" || step === "outline") {
    const outlineMd =
      humanFields?.outlineMd?.trim() ||
      renderHubOutlineDisplayMd(productionScript);
    if (outlineMd.trim()) {
      patch.outlineMd = outlineMd;
      patch.outlineHistory = pushStoryRevision(data.outlineHistory, outlineMd);
      const stylePack = visualStyleToPack(productionScript);
      if (stylePack) patch.visualStylePack = stylePack;
    }
  }

  if (step === "full_pack" || step === "character") {
    const characterMd =
      humanFields?.characterMd?.trim() ||
      renderProductionScriptCharacterMd(productionScript);
    if (characterMd.trim()) {
      patch.characterMd = characterMd;
      patch.characterHistory = pushStoryRevision(
        data.characterHistory,
        characterMd,
      );
    }
  }

  if (step === "full_pack" || step === "scene") {
    const sceneMd =
      humanFields?.sceneMd?.trim() ||
      renderProductionScriptSceneMd(productionScript);
    if (sceneMd.trim()) {
      patch.sceneMd = sceneMd;
      patch.sceneHistory = pushStoryRevision(data.sceneHistory, sceneMd);
    }
  }

  if (step === "full_pack" || step === "storyboard") {
    const storyboardMd =
      humanFields?.storyboardMd?.trim() ||
      renderProductionScriptStoryboardMd(productionScript);
    if (storyboardMd.trim()) {
      patch.storyboardMd = storyboardMd;
      patch.storyboardHistory = pushStoryRevision(
        data.storyboardHistory,
        storyboardMd,
      );
    }
  }

  if (step === "shot_prompts") {
    const storyboardMd =
      humanFields?.storyboardMd?.trim() ||
      renderProductionScriptStoryboardMd(productionScript);
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
    const humanStoryboard = normalizeStoryboardSectionFromOutline(humanGfm);
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
    const humanOutline = promotePro2HumanGfmToHubFields(humanGfm).outlineMd;
    const needsHumanOutlineRepair =
      humanOutline.trim().length > (data.outlineMd ?? "").trim().length * 1.2;
    if (!needsHumanStoryboardRepair && !needsHumanOutlineRepair) continue;
    const envelope = extractPro2ProductionScriptPatch(raw);
    if (!envelope) continue;
    return applyProductionScriptPatchToHub(data, envelope, scriptHubId, raw);
  }

  if (!outlineBlob && !storyboardBlob && hasStructured) return null;

  for (const raw of sources) {
    if (!raw?.trim()) continue;
    const envelope = extractPro2ProductionScriptPatch(raw);
    if (!envelope) continue;
    return applyProductionScriptPatchToHub(data, envelope, scriptHubId, raw);
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
  if (storedStrictUsable && !outlineBlob && !storyboardBlob) return stored;

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
    return mergeProductionScriptPatch(stored, envelope);
  }
  if (storedStrictUsable) return stored!;
  if (storedLenientUsable) return stored!;
  return stored ?? null;
}

export function hubHasStructuredProductionScript(
  data: StoryProScriptHubNodeData,
): boolean {
  return resolveHubProductionScript(data) != null;
}
