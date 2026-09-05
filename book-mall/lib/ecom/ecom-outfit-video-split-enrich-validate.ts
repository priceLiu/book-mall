/** §十 · 拆镜 enrich 残缺检测与字段兜底（不做语义补全） */

export const OUTFIT_SPLIT_UNRECOGNIZED = {
  camera: "无法识别运镜",
  action: "无法识别模特动作",
  lighting: "无法识别光影信息",
  scene: "无法识别场景信息",
} as const;

export const OUTFIT_SPLIT_MANUAL_EDIT_HINT = "【AI识别不足，请手动编辑】";

const INCOMPLETE_ENDINGS = /[，,、的了吗呢吧啊呀]$|[\u4e00-\u9fff]{1,3}$/;

/** 是否像「无法识别 xxx」兜底句 */
export function isOutfitSplitFallbackDesc(text: string): boolean {
  const t = text.trim();
  return t.startsWith("无法识别") || t === OUTFIT_SPLIT_MANUAL_EDIT_HINT;
}

/**
 * 残缺判定（§十 §三）：过短且非兜底句，或明显半截收尾。
 * 兜底句「无法识别xxx」视为完整。
 */
export function isOutfitSplitDescIncomplete(text: string, minLen = 8): boolean {
  const t = text.trim();
  if (!t) return true;
  if (isOutfitSplitFallbackDesc(t)) return false;
  if (t.length < minLen) return true;
  if (INCOMPLETE_ENDINGS.test(t) && t.length < 12) return true;
  return false;
}

export type OutfitSplitEnrichRawScene = {
  sceneId?: string;
  characterAction?: string;
  cameraMove?: string;
  lightingSetup?: string;
  sceneBackground?: string;
  parseIncomplete?: boolean;
  /** §十 LLM 字段别名 */
  action_desc?: string;
  camera_desc?: string;
  light_desc?: string;
  scene_desc?: string;
  parse_incomplete?: boolean;
};

export type OutfitSplitEnrichNormalized = {
  characterAction: string;
  cameraMove: string;
  lightingSetup: string;
  sceneBackground: string;
  parseIncomplete: boolean;
};

function pickDesc(
  primary: string | undefined,
  alias: string | undefined,
  fallback: string,
): string {
  const t = (primary ?? alias ?? "").trim();
  return t || fallback;
}

export function normalizeOutfitSplitEnrichScene(
  raw: OutfitSplitEnrichRawScene,
): OutfitSplitEnrichNormalized {
  let characterAction = pickDesc(raw.characterAction, raw.action_desc, OUTFIT_SPLIT_UNRECOGNIZED.action);
  let cameraMove = pickDesc(raw.cameraMove, raw.camera_desc, OUTFIT_SPLIT_UNRECOGNIZED.camera);
  let lightingSetup = pickDesc(raw.lightingSetup, raw.light_desc, OUTFIT_SPLIT_UNRECOGNIZED.lighting);
  let sceneBackground = pickDesc(raw.sceneBackground, raw.scene_desc, OUTFIT_SPLIT_UNRECOGNIZED.scene);

  let parseIncomplete = Boolean(raw.parseIncomplete ?? raw.parse_incomplete);

  const fields = [
    { key: "characterAction" as const, value: characterAction },
    { key: "cameraMove" as const, value: cameraMove },
    { key: "lightingSetup" as const, value: lightingSetup },
    { key: "sceneBackground" as const, value: sceneBackground },
  ];

  for (const f of fields) {
    if (isOutfitSplitDescIncomplete(f.value)) {
      parseIncomplete = true;
    }
  }

  if (parseIncomplete) {
    if (isOutfitSplitDescIncomplete(lightingSetup)) {
      lightingSetup = OUTFIT_SPLIT_MANUAL_EDIT_HINT;
    }
    if (isOutfitSplitDescIncomplete(sceneBackground)) {
      sceneBackground = OUTFIT_SPLIT_MANUAL_EDIT_HINT;
    }
  }

  return {
    characterAction,
    cameraMove,
    lightingSetup,
    sceneBackground,
    parseIncomplete,
  };
}

export function outfitSplitEnrichNeedsRetry(norm: OutfitSplitEnrichNormalized): boolean {
  if (norm.parseIncomplete) return true;
  return (
    isOutfitSplitDescIncomplete(norm.lightingSetup) ||
    isOutfitSplitDescIncomplete(norm.sceneBackground) ||
    isOutfitSplitDescIncomplete(norm.characterAction) ||
    isOutfitSplitDescIncomplete(norm.cameraMove)
  );
}
