/**
 * AI 小智 · 用户反馈入库。
 */
import type {
  PlatformAssistantFeedbackCategory,
  PlatformAssistantFeedbackStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CreateAssistantFeedbackInput = {
  userId: string;
  category: PlatformAssistantFeedbackCategory;
  userMessage: string;
  assistantReply?: string | null;
  sourceApp?: string | null;
  pageUrl?: string | null;
};

export async function createPlatformAssistantFeedback(
  input: CreateAssistantFeedbackInput,
) {
  const userMessage = input.userMessage.trim().slice(0, 4000);
  if (!userMessage) return null;

  const since = new Date(Date.now() - 10 * 60 * 1000);
  const dup = await prisma.platformAssistantFeedback.findFirst({
    where: {
      userId: input.userId,
      userMessage,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (dup) return dup;

  return prisma.platformAssistantFeedback.create({
    data: {
      userId: input.userId,
      category: input.category,
      status: "OPEN",
      userMessage,
      assistantReply: input.assistantReply?.trim().slice(0, 8000) ?? null,
      sourceApp: input.sourceApp?.trim().slice(0, 64) ?? null,
      pageUrl: input.pageUrl?.trim().slice(0, 2000) ?? null,
    },
  });
}

export type AssistantFeedbackListItem = {
  id: string;
  createdAt: Date;
  category: PlatformAssistantFeedbackCategory;
  status: PlatformAssistantFeedbackStatus;
  userMessage: string;
  assistantReply: string | null;
  sourceApp: string | null;
  pageUrl: string | null;
  user: { id: string; name: string | null; email: string | null };
};

export async function listOpenAssistantFeedback(
  limit = 30,
): Promise<AssistantFeedbackListItem[]> {
  return prisma.platformAssistantFeedback.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      category: true,
      status: true,
      userMessage: true,
      assistantReply: true,
      sourceApp: true,
      pageUrl: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getAssistantFeedbackSummary() {
  const [openTotal, openBug, openQuestion, last24h] = await Promise.all([
    prisma.platformAssistantFeedback.count({ where: { status: "OPEN" } }),
    prisma.platformAssistantFeedback.count({
      where: { status: "OPEN", category: "BUG" },
    }),
    prisma.platformAssistantFeedback.count({
      where: { status: "OPEN", category: "QUESTION" },
    }),
    prisma.platformAssistantFeedback.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return { openTotal, openBug, openQuestion, last24h };
}

export async function updateAssistantFeedbackStatus(
  id: string,
  status: PlatformAssistantFeedbackStatus,
  adminNote?: string,
) {
  return prisma.platformAssistantFeedback.update({
    where: { id },
    data: {
      status,
      adminNote: adminNote?.trim().slice(0, 2000) ?? undefined,
      reviewedAt: status !== "OPEN" ? new Date() : undefined,
    },
  });
}
