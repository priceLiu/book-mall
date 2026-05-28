import { prisma } from "@/lib/prisma";

export type ScriptAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

const MAX_MESSAGES = 80;
const MAX_CONTENT_CHARS = 24000;

function sanitizeMessages(raw: unknown): ScriptAssistantMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ScriptAssistantMessage[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const { id, role, content, createdAt } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const text = content.trim();
    if (!text || text.length > MAX_CONTENT_CHARS) continue;
    out.push({
      id: typeof id === "string" ? id : `${role}-${out.length}`,
      role,
      content: text,
      createdAt:
        typeof createdAt === "string"
          ? createdAt
          : new Date().toISOString(),
    });
  }
  return out;
}

export async function getScriptAssistantHistory(
  userId: string,
  projectId: string,
): Promise<ScriptAssistantMessage[]> {
  const pid = projectId.trim();
  if (!pid) return [];
  const row = await prisma.storyProScriptAssistantHistory.findUnique({
    where: { userId_projectId: { userId, projectId: pid } },
  });
  if (!row) return [];
  return sanitizeMessages(row.messages);
}

export async function saveScriptAssistantHistory(
  userId: string,
  projectId: string,
  messages: ScriptAssistantMessage[],
): Promise<ScriptAssistantMessage[]> {
  const pid = projectId.trim();
  if (!pid) {
    throw new Error("projectId required");
  }
  const clean = sanitizeMessages(messages);
  await prisma.storyProScriptAssistantHistory.upsert({
    where: { userId_projectId: { userId, projectId: pid } },
    create: { userId, projectId: pid, messages: clean },
    update: { messages: clean },
  });
  return clean;
}

export async function clearScriptAssistantHistory(
  userId: string,
  projectId: string,
): Promise<void> {
  const pid = projectId.trim();
  if (!pid) return;
  await prisma.storyProScriptAssistantHistory.deleteMany({
    where: { userId, projectId: pid },
  });
}

export function sanitizeClientChatTurns(
  raw: unknown,
): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) {
    throw new Error("messages_must_be_array");
  }
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as { role?: string; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const text = content.trim();
    if (!text) continue;
    if (text.length > MAX_CONTENT_CHARS) {
      throw new Error("message_too_long");
    }
    out.push({ role, content: text });
  }
  return out;
}
