import { prisma } from "@/lib/prisma";

export type ScriptAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ScriptAssistantHistoryThread = {
  workflowKey: string;
  theme: string | null;
  messageCount: number;
  updatedAt: string;
};

const MAX_MESSAGES = 80;
const MAX_CONTENT_CHARS = 24000;
/** 旧版按 projectId 单条存储 */
export const SCRIPT_ASSISTANT_LEGACY_WORKFLOW_KEY = "";

function normalizeWorkflowKey(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

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

export async function listScriptAssistantHistoryThreads(
  userId: string,
  projectId: string,
): Promise<ScriptAssistantHistoryThread[]> {
  const pid = projectId.trim();
  if (!pid) return [];
  const rows = await prisma.storyProScriptAssistantHistory.findMany({
    where: { userId, projectId: pid },
    orderBy: { updatedAt: "desc" },
    select: { workflowKey: true, theme: true, messages: true, updatedAt: true },
  });
  return rows.map((row) => ({
    workflowKey: row.workflowKey,
    theme: row.theme,
    messageCount: sanitizeMessages(row.messages).length,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getScriptAssistantHistory(
  userId: string,
  projectId: string,
  workflowKey?: string | null,
): Promise<ScriptAssistantMessage[]> {
  const pid = projectId.trim();
  if (!pid) return [];
  const key = normalizeWorkflowKey(workflowKey);
  const row = await prisma.storyProScriptAssistantHistory.findUnique({
    where: {
      userId_projectId_workflowKey: {
        userId,
        projectId: pid,
        workflowKey: key,
      },
    },
  });
  if (!row) return [];
  return sanitizeMessages(row.messages);
}

export async function saveScriptAssistantHistory(
  userId: string,
  projectId: string,
  messages: ScriptAssistantMessage[],
  options?: { workflowKey?: string | null; theme?: string | null },
): Promise<ScriptAssistantMessage[]> {
  const pid = projectId.trim();
  if (!pid) {
    throw new Error("projectId required");
  }
  const key = normalizeWorkflowKey(options?.workflowKey);
  const clean = sanitizeMessages(messages);
  const theme =
    options?.theme?.trim() || undefined;
  await prisma.storyProScriptAssistantHistory.upsert({
    where: {
      userId_projectId_workflowKey: {
        userId,
        projectId: pid,
        workflowKey: key,
      },
    },
    create: {
      userId,
      projectId: pid,
      workflowKey: key,
      theme: theme ?? null,
      messages: clean,
    },
    update: {
      messages: clean,
      ...(theme !== undefined ? { theme: theme || null } : {}),
    },
  });
  return clean;
}

export async function clearScriptAssistantHistory(
  userId: string,
  projectId: string,
  workflowKey?: string | null,
): Promise<void> {
  const pid = projectId.trim();
  if (!pid) return;
  const key = normalizeWorkflowKey(workflowKey);
  if (key) {
    await prisma.storyProScriptAssistantHistory.deleteMany({
      where: { userId, projectId: pid, workflowKey: key },
    });
    return;
  }
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
