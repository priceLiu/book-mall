import { z } from "zod";

export const ECOM_IMAGE_LAYER_MODULE = "image-layer";

const bboxSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

const stackItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  zIndex: z.number(),
  bbox: z
    .object({
      normalized: bboxSchema.optional(),
      absolute: bboxSchema.optional(),
    })
    .optional(),
  name: z.string().optional(),
  isBackground: z.boolean(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
});

const stackSchema = z.object({
  sourceImageUrl: z.string().optional(),
  background: stackItemSchema,
  layers: z.array(stackItemSchema),
  logId: z.string().optional(),
});

const editEntrySchema = z.object({
  layerId: z.string(),
  prompt: z.string(),
});

const savedImageSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  at: z.string().optional(),
  source: z.enum(["library", "auto"]).optional(),
});

export const imageLayerWorkspaceSchema = z.object({
  sourceImageUrl: z.string().nullable().optional(),
  /** 首次上传的原图，擦除/重绘后仍保留给中栏对照 */
  originalImageUrl: z.string().nullable().optional(),
  savedImages: z.array(savedImageSchema).max(40).optional(),
  savedImageIndex: z.number().int().min(0).optional(),
  firstOrigin: z.string().optional(),
  stack: stackSchema.nullable().optional(),
  pendingBbox: bboxSchema.nullable().optional(),
  pendingBboxes: z.array(bboxSchema).max(16).optional(),
  canvasDims: z.object({ w: z.number(), h: z.number() }).optional(),
  displayDims: z.object({ w: z.number(), h: z.number() }).optional(),
  selectedLayerId: z.string().nullable().optional(),
  editPrompt: z.string().optional(),
  editEntries: z.array(editEntrySchema).optional(),
  toolMode: z
    .enum(["layer-view", "bg-replace", "retouch", "erase", "decompose-bbox"])
    .optional(),
  bgReplace: z
    .object({
      refPrompt: z.string().optional(),
      refImageUrl: z.string().optional(),
      refBbox: bboxSchema.nullable().optional(),
    })
    .optional(),
});

export type ImageLayerWorkspace = z.infer<typeof imageLayerWorkspaceSchema>;

export const IMAGE_LAYER_GENERATION_KINDS = [
  "upload",
  "decompose",
  "edit",
  "export",
  "bg-replace",
  "retouch",
] as const;

export type ImageLayerGenerationKind = (typeof IMAGE_LAYER_GENERATION_KINDS)[number];

export type ImageLayerGenerationRef = {
  url: string;
  label?: string;
};

export type ImageLayerProjectGeneration = {
  id: string;
  kind: ImageLayerGenerationKind;
  at: string;
  title: string;
  prompt?: string | null;
  ossUrl: string;
  logId?: string | null;
  modelKey?: string | null;
  compareFromUrl?: string | null;
  refImages?: ImageLayerGenerationRef[];
  workspace?: ImageLayerWorkspace;
};

export type ImageLayerProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  workspace: ImageLayerWorkspace;
  generations: ImageLayerProjectGeneration[];
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export function sanitizeImageLayerWorkspace(raw: unknown): ImageLayerWorkspace {
  const parsed = imageLayerWorkspaceSchema.safeParse(raw ?? {});
  if (parsed.success) {
    const ws = parsed.data;
    if (!ws.pendingBboxes?.length && ws.pendingBbox) {
      return { ...ws, pendingBboxes: [ws.pendingBbox] };
    }
    return ws;
  }
  return {};
}

export function sanitizeImageLayerGenerationRefs(raw: unknown): ImageLayerGenerationRef[] {
  if (!Array.isArray(raw)) return [];
  const out: ImageLayerGenerationRef[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const url = typeof (row as { url?: unknown }).url === "string"
      ? (row as { url: string }).url.trim()
      : "";
    if (!url) continue;
    const labelRaw = (row as { label?: unknown }).label;
    const label = typeof labelRaw === "string" ? labelRaw.trim() : "";
    out.push(label ? { url, label } : { url });
    if (out.length >= 8) break;
  }
  return out;
}

export function sanitizeImageLayerGenerations(raw: unknown): ImageLayerProjectGeneration[] {
  if (!Array.isArray(raw)) return [];
  const out: ImageLayerProjectGeneration[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const kind = r.kind;
    const ossUrl = typeof r.ossUrl === "string" ? r.ossUrl : "";
    const at = typeof r.at === "string" ? r.at : "";
    const title = typeof r.title === "string" ? r.title : "";
    if (!id || !ossUrl || !at || !title) continue;
    if (
      kind !== "upload" &&
      kind !== "decompose" &&
      kind !== "edit" &&
      kind !== "export" &&
      kind !== "bg-replace" &&
      kind !== "retouch"
    ) {
      continue;
    }
    const ws = sanitizeImageLayerWorkspace(r.workspace);
    const refs = sanitizeImageLayerGenerationRefs(r.refImages);
    const compareFromUrl =
      typeof r.compareFromUrl === "string" ? r.compareFromUrl.trim() : "";
    out.push({
      id,
      kind,
      at,
      title,
      ossUrl,
      prompt: typeof r.prompt === "string" ? r.prompt : null,
      logId: typeof r.logId === "string" ? r.logId : null,
      modelKey: typeof r.modelKey === "string" ? r.modelKey : null,
      ...(compareFromUrl ? { compareFromUrl } : {}),
      ...(refs.length ? { refImages: refs } : {}),
      ...(Object.keys(ws).length ? { workspace: ws } : {}),
    });
  }
  return out.slice(0, 80);
}
