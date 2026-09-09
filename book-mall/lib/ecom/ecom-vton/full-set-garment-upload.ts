import { parseVtonFullSetGarmentFromImage } from "@/lib/ecom/ecom-vton/garment-parsing";
import { patchVtonGarmentPool } from "@/lib/ecom/ecom-vton-project-mutations";
import { findGarmentInPool } from "@/lib/ecom/ecom-vton/validate";
import type { VtonGarmentItem, VtonProjectMeta } from "@/lib/ecom/ecom-vton/types";

export type VtonFullSetUploadSlot = "composite" | "top" | "bottom";

export function isFullSetGarmentReady(g: VtonGarmentItem): boolean {
  return Boolean(g.parsedTopUrl?.trim() && g.parsedBottomUrl?.trim());
}

/** 上传一张套装图后自动分割；已有手动双槽则不重复分割 */
export async function enrichFullSetGarmentRows(
  userId: string,
  projectId: string,
  consumerToolKey: string,
  rows: Array<Omit<VtonGarmentItem, "id"> & { id?: string }>,
): Promise<Array<Omit<VtonGarmentItem, "id"> & { id?: string }>> {
  const enriched: Array<Omit<VtonGarmentItem, "id"> & { id?: string }> = [];
  for (const row of rows) {
    if (row.kind !== "full_set" || !row.ossUrl?.trim()) {
      enriched.push(row);
      continue;
    }
    const hasTop = Boolean(row.parsedTopUrl?.trim());
    const hasBottom = Boolean(row.parsedBottomUrl?.trim());
    if (hasTop && hasBottom) {
      enriched.push(row);
      continue;
    }
    if (hasTop || hasBottom) {
      enriched.push(row);
      continue;
    }
    const parsed = await parseVtonFullSetGarmentFromImage({
      userId,
      garmentImageUrl: row.ossUrl.trim(),
      projectId,
      consumerToolKey,
    });
    enriched.push({
      ...row,
      fullSetInputMode: "composite",
      parsedTopUrl: parsed.topGarmentUrl,
      parsedBottomUrl: parsed.bottomGarmentUrl,
    });
  }
  return enriched;
}

export function applyFullSetGarmentUpload(opts: {
  meta: VtonProjectMeta;
  kind: VtonGarmentItem["kind"];
  ossUrl: string;
  label: string;
  source: VtonGarmentItem["source"];
  fullSetSlot?: VtonFullSetUploadSlot;
  garmentId?: string;
}): VtonProjectMeta {
  const slot = opts.fullSetSlot ?? (opts.kind === "full_set" ? "composite" : undefined);
  if (opts.kind !== "full_set" || !slot) {
    return patchVtonGarmentPool(opts.meta, {
      add: [
        {
          kind: opts.kind,
          ossUrl: opts.ossUrl,
          label: opts.label,
          source: opts.source,
        },
      ],
    });
  }

  if (slot === "composite") {
    const garmentId = opts.garmentId?.trim();
    if (garmentId) {
      const existing = findGarmentInPool(opts.meta.garmentPool ?? [], garmentId);
      if (!existing || existing.kind !== "full_set") {
        throw new Error("套装条目不存在");
      }
      return patchVtonGarmentPool(opts.meta, {
        update: [
          {
            id: garmentId,
            patch: {
              ossUrl: opts.ossUrl,
              label: opts.label,
              parsedTopUrl: undefined,
              parsedBottomUrl: undefined,
            },
          },
        ],
      });
    }
    return patchVtonGarmentPool(opts.meta, {
      add: [
        {
          kind: "full_set",
          ossUrl: opts.ossUrl,
          label: opts.label,
          source: opts.source,
          fullSetInputMode: "composite",
        },
      ],
    });
  }

  const garmentId = opts.garmentId?.trim();
  if (slot === "top") {
    if (garmentId) {
      const existing = findGarmentInPool(opts.meta.garmentPool ?? [], garmentId);
      if (!existing || existing.kind !== "full_set") {
        throw new Error("套装条目不存在");
      }
      return patchVtonGarmentPool(opts.meta, {
        update: [
          {
            id: garmentId,
            patch: {
              parsedTopUrl: opts.ossUrl,
              ossUrl: existing.ossUrl?.trim() ? existing.ossUrl : opts.ossUrl,
            },
          },
        ],
      });
    }
    return patchVtonGarmentPool(opts.meta, {
      add: [
        {
          kind: "full_set",
          ossUrl: opts.ossUrl,
          parsedTopUrl: opts.ossUrl,
          label: opts.label,
          source: opts.source,
          fullSetInputMode: "manual",
        },
      ],
    });
  }

  if (!garmentId) {
    return patchVtonGarmentPool(opts.meta, {
      add: [
        {
          kind: "full_set",
          ossUrl: opts.ossUrl,
          parsedBottomUrl: opts.ossUrl,
          label: opts.label,
          source: opts.source,
          fullSetInputMode: "manual",
        },
      ],
    });
  }
  const existing = findGarmentInPool(opts.meta.garmentPool ?? [], garmentId);
  if (!existing || existing.kind !== "full_set") {
    throw new Error("套装条目不存在");
  }
  return patchVtonGarmentPool(opts.meta, {
    update: [
      {
        id: garmentId,
        patch: {
          parsedBottomUrl: opts.ossUrl,
          ossUrl: existing.ossUrl?.trim() || existing.parsedTopUrl?.trim() || opts.ossUrl,
        },
      },
    ],
  });
}

export async function finalizeFullSetGarmentAfterCompositeUpload(opts: {
  meta: VtonProjectMeta;
  garmentId: string;
  userId: string;
  projectId: string;
  consumerToolKey: string;
}): Promise<VtonProjectMeta> {
  const garment = findGarmentInPool(opts.meta.garmentPool ?? [], opts.garmentId);
  if (!garment?.ossUrl?.trim()) throw new Error("套装条目不存在");
  const parsed = await parseVtonFullSetGarmentFromImage({
    userId: opts.userId,
    garmentImageUrl: garment.ossUrl,
    projectId: opts.projectId,
    consumerToolKey: opts.consumerToolKey,
  });
  return patchVtonGarmentPool(opts.meta, {
    update: [
      {
        id: opts.garmentId,
        patch: {
          parsedTopUrl: parsed.topGarmentUrl,
          parsedBottomUrl: parsed.bottomGarmentUrl,
        },
      },
    ],
  });
}
