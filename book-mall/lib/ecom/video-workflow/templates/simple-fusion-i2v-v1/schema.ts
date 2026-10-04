import { z } from "zod";

const lookSchema = z.object({
  lookId: z.string(),
  garmentId: z.string(),
  fusedImageUrl: z.string().optional(),
  clipVideoUrl: z.string().optional(),
  status: z.string().optional(),
});

export const simpleFusionPayloadSchema = z.object({
  looks: z.array(lookSchema).optional(),
  composeResult: z
    .object({
      videoUrl: z.string(),
    })
    .optional(),
});

export function parseSimpleFusionPayload(
  action: string,
  payload: unknown,
): z.infer<typeof simpleFusionPayloadSchema> | null {
  if (action !== "fusion_complete" && action !== "clip_generate_complete" && action !== "compose_complete") {
    return null;
  }
  const parsed = simpleFusionPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
