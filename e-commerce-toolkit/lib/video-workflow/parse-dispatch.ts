import {
  extractEcomVideoWorkflowEnvelope,
  parseWorkflowEnvelopeJson,
  type WorkflowEnvelope,
} from "@/lib/video-workflow/envelope";
import { getVideoTemplateEngine } from "@/lib/video-workflow/registry";

export type ParseEcomVideoWorkflowResult = {
  envelope: WorkflowEnvelope;
  parsed: ReturnType<NonNullable<ReturnType<typeof getVideoTemplateEngine>>["parseEnvelope"]>;
};

export function parseEcomVideoWorkflow(raw: unknown): ParseEcomVideoWorkflowResult | null {
  const envelope =
    typeof raw === "string"
      ? extractEcomVideoWorkflowEnvelope(raw) ?? null
      : parseWorkflowEnvelopeJson(raw);
  if (!envelope) return null;

  const engine = getVideoTemplateEngine(envelope.templateId);
  if (!engine) return null;

  if (!engine.validatePayload(envelope.action, envelope.payload)) {
    return null;
  }

  const parsed = engine.parseEnvelope(envelope);
  if (!parsed.ok) return null;

  return { envelope, parsed };
}

export function parseEcomVideoWorkflowLenient(
  raw: unknown,
): { envelope: WorkflowEnvelope; error?: string } | null {
  const envelope =
    typeof raw === "string"
      ? extractEcomVideoWorkflowEnvelope(raw) ?? null
      : parseWorkflowEnvelopeJson(raw);
  if (!envelope) return null;

  const engine = getVideoTemplateEngine(envelope.templateId);
  if (!engine) return { envelope, error: `未知 templateId: ${envelope.templateId}` };

  const parsed = engine.parseEnvelope(envelope);
  if (!parsed.ok) return { envelope, error: parsed.error };

  return { envelope };
}
