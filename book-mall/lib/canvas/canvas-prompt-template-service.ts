import { prisma } from "@/lib/prisma";
import type { CanvasPromptEngineKind } from "./canvas-prompt-templates";
import {
  CANVAS_USER_PROMPT_TEMPLATE_MAX,
  getBuiltinPromptTemplate,
  isBuiltinPromptTemplateId,
  listBuiltinPromptTemplates,
  type CanvasPromptTemplateDto,
} from "./canvas-prompt-templates";

function rowToDto(row: {
  id: string;
  engine: string;
  name: string;
  content: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): CanvasPromptTemplateDto {
  return {
    id: row.id,
    engine: row.engine as CanvasPromptEngineKind,
    name: row.name,
    content: row.content,
    builtin: false,
    archived: row.deletedAt != null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.deletedAt
      ? { deletedAt: row.deletedAt.toISOString() }
      : {}),
  };
}

const activeUserWhere = { deletedAt: null as null };

export async function countActiveUserPromptTemplates(
  userId: string,
): Promise<number> {
  return prisma.canvasPromptTemplate.count({
    where: { userId, ...activeUserWhere },
  });
}

export async function listPromptTemplatesForUser(
  userId: string,
  engine?: CanvasPromptEngineKind,
  opts?: { includeArchived?: boolean },
): Promise<CanvasPromptTemplateDto[]> {
  const builtins = listBuiltinPromptTemplates(engine);
  const rows = await prisma.canvasPromptTemplate.findMany({
    where: {
      userId,
      ...(engine ? { engine } : {}),
      ...(opts?.includeArchived ? {} : activeUserWhere),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const user = rows.map(rowToDto);
  return [...builtins, ...user].sort(
    (a, b) =>
      Number(b.builtin) - Number(a.builtin) ||
      Number(a.archived) - Number(b.archived) ||
      a.sortOrder - b.sortOrder,
  );
}

export async function createUserPromptTemplate(
  userId: string,
  args: { engine: CanvasPromptEngineKind; name: string; content: string },
): Promise<CanvasPromptTemplateDto> {
  const count = await countActiveUserPromptTemplates(userId);
  if (count >= CANVAS_USER_PROMPT_TEMPLATE_MAX) {
    throw new Error(
      `PROMPT_TEMPLATE_LIMIT：自定义模板最多 ${CANVAS_USER_PROMPT_TEMPLATE_MAX} 条（LLM 与 IMAGE 合计）`,
    );
  }
  const name = args.name.trim();
  const content = args.content.trim();
  if (!name || !content) {
    throw new Error("INVALID_INPUT：名称与内容不能为空");
  }
  const row = await prisma.canvasPromptTemplate.create({
    data: {
      userId,
      engine: args.engine,
      name,
      content,
      sortOrder: count,
    },
  });
  return rowToDto(row);
}

export async function updateUserPromptTemplate(
  userId: string,
  id: string,
  patch: { name?: string; content?: string; sortOrder?: number },
): Promise<CanvasPromptTemplateDto> {
  if (isBuiltinPromptTemplateId(id)) {
    throw new Error("FORBIDDEN：系统内置模板不可修改");
  }
  const existing = await prisma.canvasPromptTemplate.findFirst({
    where: { id, userId, ...activeUserWhere },
  });
  if (!existing) throw new Error("NOT_FOUND");
  const row = await prisma.canvasPromptTemplate.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.content !== undefined ? { content: patch.content.trim() } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    },
  });
  return rowToDto(row);
}

/** 软删除：归档保留 name/content 快照，释放活跃配额 */
export async function deleteUserPromptTemplate(
  userId: string,
  id: string,
): Promise<void> {
  if (isBuiltinPromptTemplateId(id)) {
    throw new Error("FORBIDDEN：系统内置模板不可删除");
  }
  const existing = await prisma.canvasPromptTemplate.findFirst({
    where: { id, userId, ...activeUserWhere },
  });
  if (!existing) throw new Error("NOT_FOUND");
  await prisma.canvasPromptTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/** 统计仍引用该模板 id 的画布节点数（ai-engine / image-engine） */
export async function countPromptTemplateUsage(
  userId: string,
  templateId: string,
): Promise<number> {
  const projects = await prisma.canvasProject.findMany({
    where: { userId, deletedAt: null },
    select: { canvas: true },
  });
  let count = 0;
  for (const p of projects) {
    const graph = p.canvas as {
      nodes?: Array<{ type?: string; data?: Record<string, unknown> }>;
    };
    for (const n of graph.nodes ?? []) {
      if (n.type !== "ai-engine" && n.type !== "image-engine") continue;
      if (n.data?.promptTemplateId === templateId) count++;
    }
  }
  return count;
}

export function resolvePromptTemplateContent(
  templates: CanvasPromptTemplateDto[],
  id: string,
): string | null {
  const hit = templates.find((t) => t.id === id);
  if (hit) return hit.content;
  const builtin = getBuiltinPromptTemplate(id);
  return builtin?.content ?? null;
}
