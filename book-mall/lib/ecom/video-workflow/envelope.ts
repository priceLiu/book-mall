import { z } from "zod";

export const ECOM_VIDEO_WORKFLOW_SCHEMA_VERSION = "ecom-video-workflow/v1" as const;

export const WORKFLOW_ACTIONS = [
  "scene_split_complete",
  "scene_preview_regenerated",
  "scenes_edited",
  "refs_locked",
  "shot_generate_complete",
  "shot_generate_request",
  "compose_complete",
] as const;

export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export const workflowTaskStatusSchema = z.enum(["success", "processing", "failed"]);

export const workflowEnvelopeSchema = z.object({
  schemaVersion: z.literal(ECOM_VIDEO_WORKFLOW_SCHEMA_VERSION),
  templateId: z.string().min(1),
  action: z.string().min(1),
  taskStatus: workflowTaskStatusSchema,
  taskId: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  failReason: z.string().optional(),
});

export type WorkflowEnvelope = z.infer<typeof workflowEnvelopeSchema>;

export function buildWorkflowEnvelope<TPayload extends Record<string, unknown>>(opts: {
  templateId: string;
  action: string;
  taskStatus: z.infer<typeof workflowTaskStatusSchema>;
  taskId: string;
  payload: TPayload;
  failReason?: string;
}): WorkflowEnvelope & { payload: TPayload } {
  return {
    schemaVersion: ECOM_VIDEO_WORKFLOW_SCHEMA_VERSION,
    templateId: opts.templateId,
    action: opts.action,
    taskStatus: opts.taskStatus,
    taskId: opts.taskId,
    payload: opts.payload,
    failReason: opts.failReason,
  };
}

export const ECOM_VIDEO_WORKFLOW_FENCE = "ecom-video-workflow";

export function toEcomVideoWorkflowFence(envelope: WorkflowEnvelope): string {
  return `\`\`\`${ECOM_VIDEO_WORKFLOW_FENCE}\n${JSON.stringify(envelope, null, 2)}\n\`\`\``;
}

export function extractEcomVideoWorkflowEnvelope(text: string): WorkflowEnvelope | null {
  const closed = text.match(/```ecom-video-workflow\s*([\s\S]*?)```/i);
  const open = text.match(/```ecom-video-workflow\s*([\s\S]*)$/i);
  const raw = (closed?.[1] ?? open?.[1])?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = workflowEnvelopeSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseWorkflowEnvelopeJson(raw: unknown): WorkflowEnvelope | null {
  const result = workflowEnvelopeSchema.safeParse(raw);
  return result.success ? result.data : null;
}
