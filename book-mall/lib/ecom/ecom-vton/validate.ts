import {
  ECOM_VTON_MAX_BATCH_LOOKS,
  type VtonGarmentItem,
  type VtonGarmentMode,
  type VtonLookKind,
  type VtonLookSpec,
  type VtonRefMode,
  type VtonRefs,
  type VtonTryonUrlInputs,
} from "@/lib/ecom/ecom-vton/types";

export function findGarmentInPool(
  pool: VtonGarmentItem[],
  id: string | undefined,
): VtonGarmentItem | undefined {
  if (!id?.trim()) return undefined;
  return pool.find((g) => g.id === id.trim());
}

/** 试衣前归一化搭配行：有 fullSetGarmentId 时强制走套装双槽逻辑 */
export function normalizeLookForTryon(
  look: VtonLookSpec,
  garmentPool: VtonGarmentItem[] = [],
): VtonLookSpec {
  if (look.fullSetGarmentId?.trim()) {
    return {
      ...look,
      kind: "full_set",
      topGarmentId: undefined,
      bottomGarmentId: undefined,
      onePieceGarmentId: undefined,
    };
  }
  if (look.kind === "full_set") return look;
  const topAsSet = findGarmentInPool(garmentPool, look.topGarmentId);
  if (topAsSet?.kind === "full_set") {
    return {
      ...look,
      kind: "full_set",
      fullSetGarmentId: topAsSet.id,
      topGarmentId: undefined,
      bottomGarmentId: undefined,
      onePieceGarmentId: undefined,
    };
  }
  return look;
}

export function resolveLookTryonUrls(opts: {
  look: VtonLookSpec;
  garmentPool: VtonGarmentItem[];
  modelUrl: string;
}): VtonTryonUrlInputs {
  const personImageUrl = opts.modelUrl.trim();
  if (!personImageUrl) throw new Error("缺少模特全身照");

  const garmentPool = opts.garmentPool;
  const look = normalizeLookForTryon(opts.look, garmentPool);

  if (look.kind === "two_piece") {
    const top = findGarmentInPool(garmentPool, look.topGarmentId);
    const bottom = findGarmentInPool(garmentPool, look.bottomGarmentId);
    if (!top || top.kind !== "top") throw new Error(`搭配 ${look.label ?? look.id} 缺少上装`);
    if (!bottom || bottom.kind !== "bottom") {
      throw new Error(`搭配 ${look.label ?? look.id} 缺少下装`);
    }
    return {
      personImageUrl,
      topGarmentUrl: top.ossUrl,
      bottomGarmentUrl: bottom.ossUrl,
      lookKind: "two_piece",
    };
  }

  if (look.kind === "one_piece") {
    const piece = findGarmentInPool(garmentPool, look.onePieceGarmentId);
    if (!piece || piece.kind !== "one_piece") {
      throw new Error(`搭配 ${look.label ?? look.id} 缺少连体/裙装`);
    }
    return {
      personImageUrl,
      topGarmentUrl: piece.ossUrl,
      lookKind: "one_piece",
    };
  }

  if (look.kind === "full_set") {
    const set = findGarmentInPool(garmentPool, look.fullSetGarmentId);
    if (!set?.ossUrl?.trim()) {
      throw new Error(`搭配 ${look.label ?? look.id} 缺少套装`);
    }
    return {
      personImageUrl,
      topGarmentUrl: set.ossUrl,
      lookKind: "full_set",
    };
  }

  if (look.kind === "top_only") {
    const top = findGarmentInPool(garmentPool, look.topGarmentId);
    if (!top || top.kind !== "top") throw new Error(`搭配 ${look.label ?? look.id} 缺少上装`);
    return {
      personImageUrl,
      topGarmentUrl: top.ossUrl,
      lookKind: "top_only",
    };
  }

  const bottom = findGarmentInPool(garmentPool, look.bottomGarmentId);
  if (!bottom || bottom.kind !== "bottom") {
    throw new Error(`搭配 ${look.label ?? look.id} 缺少下装`);
  }
  return {
    personImageUrl,
    bottomGarmentUrl: bottom.ossUrl,
    lookKind: "bottom_only",
  };
}

export function assertBatchLooksValid(looks: VtonLookSpec[]): void {
  if (looks.length < 1) throw new Error("请至少添加 1 套搭配");
  if (looks.length > ECOM_VTON_MAX_BATCH_LOOKS) {
    throw new Error(`单次最多试衣 ${ECOM_VTON_MAX_BATCH_LOOKS} 套`);
  }
}

export function assertLooksResolvable(
  looks: VtonLookSpec[],
  garmentPool: VtonGarmentItem[],
  modelUrl: string,
): void {
  assertBatchLooksValid(looks);
  for (const look of looks) {
    resolveLookTryonUrls({ look, garmentPool, modelUrl });
  }
}

export function expandTopBottomCartesianLooks(opts: {
  topIds: string[];
  bottomIds: string[];
  createId: () => string;
}): VtonLookSpec[] {
  const looks: VtonLookSpec[] = [];
  for (const topGarmentId of opts.topIds) {
    for (const bottomGarmentId of opts.bottomIds) {
      if (looks.length >= ECOM_VTON_MAX_BATCH_LOOKS) break;
      looks.push({
        id: opts.createId(),
        kind: "two_piece",
        topGarmentId,
        bottomGarmentId,
        label: `上×下 ${looks.length + 1}`,
      });
    }
    if (looks.length >= ECOM_VTON_MAX_BATCH_LOOKS) break;
  }
  return looks;
}

// --- legacy single-slot refs (outfit backward compat) ---

export function isVtonGarmentRefsReady(
  garmentMode: VtonGarmentMode,
  refs: VtonRefs,
): boolean {
  if (garmentMode === "two_piece") {
    return Boolean(refs.topGarment?.ossUrl?.trim() && refs.bottomGarment?.ossUrl?.trim());
  }
  return Boolean(refs.clothing?.ossUrl?.trim());
}

export function isVtonModelRefReady(refs: VtonRefs): boolean {
  return Boolean(refs.model?.ossUrl?.trim());
}

export function isVtonRefsReadyForTryon(opts: {
  outfitRefMode: VtonRefMode;
  garmentMode: VtonGarmentMode;
  refs: VtonRefs;
}): boolean {
  if (opts.outfitRefMode === "already_dressed") {
    return isVtonModelRefReady(opts.refs);
  }
  if (!isVtonModelRefReady(opts.refs)) return false;
  return isVtonGarmentRefsReady(opts.garmentMode, opts.refs);
}

export function resolveVtonTryonInputs(opts: {
  outfitRefMode: VtonRefMode;
  garmentMode: VtonGarmentMode;
  refs: VtonRefs;
}): VtonTryonUrlInputs {
  if (opts.outfitRefMode === "already_dressed") {
    const url = opts.refs.model?.ossUrl?.trim();
    if (!url) throw new Error("请先上传已穿搭全身照");
    return { personImageUrl: url, topGarmentUrl: url, lookKind: "one_piece" };
  }

  const personImageUrl = opts.refs.model?.ossUrl?.trim();
  if (!personImageUrl) throw new Error("缺少模特全身照");

  if (opts.garmentMode === "two_piece") {
    const topGarmentUrl = opts.refs.topGarment?.ossUrl?.trim();
    const bottomGarmentUrl = opts.refs.bottomGarment?.ossUrl?.trim();
    if (!topGarmentUrl || !bottomGarmentUrl) {
      throw new Error("请先上传上装与下装");
    }
    return {
      personImageUrl,
      topGarmentUrl,
      bottomGarmentUrl,
      lookKind: "two_piece",
    };
  }

  const topGarmentUrl = opts.refs.clothing?.ossUrl?.trim();
  if (!topGarmentUrl) throw new Error("缺少服装参考图");
  return { personImageUrl, topGarmentUrl, lookKind: "one_piece" };
}

export function lookKindToGarmentMode(kind: VtonLookKind): VtonGarmentMode {
  return kind === "two_piece" ? "two_piece" : "one_piece";
}
