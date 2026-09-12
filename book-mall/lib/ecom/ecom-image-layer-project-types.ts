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

export const imageLayerWorkspaceSchema = z.object({
  sourceImageUrl: z.string().nullable().optional(),
  stack: stackSchema.nullable().optional(),
  pendingBbox: bboxSchema.nullable().optional(),
  canvasDims: z.object({ w: z.number(), h: z.number() }).optional(),
  displayDims: z.object({ w: z.number(), h: z.number() }).optional(),
  selectedLayerId: z.string().nullable().optional(),
  editPrompt: z.string().optional(),
  editEntries: z.array(editEntrySchema).optional(),
});

export type ImageLayerWorkspace = z.infer<typeof imageLayerWorkspaceSchema>;

export type ImageLayerProjectGeneration = {
  id: string;
  kind: "upload" | "decompose" | "edit" | "export";
  at: string;
  title: string;
  prompt?: string | null;
  ossUrl: string;
  logId?: string | null;
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
  if (parsed.success) return parsed.data;
  return {};
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
    if (kind !== "upload" && kind !== "decompose" && kind !== "edit" && kind !== "export") {
      continue;
    }
    out.push({
      id,
      kind,
      at,
      title,
      ossUrl,
      prompt: typeof r.prompt === "string" ? r.prompt : null,
      logId: typeof r.logId === "string" ? r.logId : null,
    });
  }
  return out.slice(0, 80);
}
