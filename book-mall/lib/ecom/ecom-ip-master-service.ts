import { Prisma } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  bumpIpMasterVersion,
  ECOM_IP_MASTER_MODULE,
  getActiveIpMasterTemplate,
  IP_MASTER_BENCHMARK_MAX,
  parseIpMasterMeta,
  parseIpMasterPlan,
  sanitizeIpMasterChatMessages,
  sanitizeIpMasterReferences,
  type IpMasterChatMessage,
  type IpMasterMeta,
  type IpMasterPlan,
  type IpMasterReference,
  type IpMasterSettings,
  type IpMasterTemplateSource,
  type IpMasterTemplateVersion,
} from "@/lib/ecom/ecom-ip-master-types";
import { prisma } from "@/lib/prisma";

export type EcomIpMasterProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: IpMasterSettings;
  references: IpMasterReference[];
  chatHistory: IpMasterChatMessage[];
  plan: IpMasterPlan;
  meta: IpMasterMeta | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: unknown;
  settings: unknown;
  references: unknown;
  chatHistory: unknown;
  plan: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: Row): EcomIpMasterProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings: (row.settings as IpMasterSettings) ?? {},
    references: sanitizeIpMasterReferences(row.references),
    chatHistory: sanitizeIpMasterChatMessages(row.chatHistory),
    plan: parseIpMasterPlan(row.plan),
    meta: parseIpMasterMeta(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEcomIpMasterProjects(userId: string) {
  const rows = await prisma.ecomIpMasterProject.findMany({
    where: { userId, module: ECOM_IP_MASTER_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listEcomIpMasterProjectSummaries(userId: string) {
  const rows = await prisma.ecomIpMasterProject.findMany({
    where: { userId, module: ECOM_IP_MASTER_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, meta: true },
  });
  return rows.map((row) => {
    const meta = parseIpMasterMeta(row.meta);
    const active = getActiveIpMasterTemplate(meta);
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      thumbnailUrl: sanitizeIpMasterReferences(row.references)[0]?.ossUrl ?? null,
      activeVersion: active?.version ?? null,
    };
  });
}

export async function createEcomIpMasterProject(
  userId: string,
  opts?: { title?: string },
): Promise<EcomIpMasterProjectDto> {
  const row = await prisma.ecomIpMasterProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "IP 母版",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      plan: { steps: {} } as Prisma.InputJsonValue,
      settings: {} as Prisma.InputJsonValue,
      meta: { workflow: { currentStepId: "input" } } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomIpMasterProject(
  userId: string,
  projectId: string,
): Promise<EcomIpMasterProjectDto | null> {
  const row = await prisma.ecomIpMasterProject.findFirst({
    where: { id: projectId, userId },
  });
  return row ? rowToDto(row) : null;
}

export async function updateEcomIpMasterProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    brief?: Record<string, unknown>;
    settings?: IpMasterSettings;
    references?: IpMasterReference[];
    chatHistory?: IpMasterChatMessage[];
    plan?: IpMasterPlan;
    status?: string;
    meta?: IpMasterMeta;
  },
): Promise<EcomIpMasterProjectDto> {
  const existing = await prisma.ecomIpMasterProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomIpMasterProjectUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 120);
  if (patch.brief !== undefined) data.brief = patch.brief as Prisma.InputJsonValue;
  if (patch.settings !== undefined) {
    const prev = (existing.settings as IpMasterSettings | null) ?? {};
    data.settings = { ...prev, ...patch.settings } as Prisma.InputJsonValue;
  }
  if (patch.references !== undefined) {
    data.references = sanitizeIpMasterReferences(
      patch.references,
    ) as unknown as Prisma.InputJsonValue;
  }
  if (patch.chatHistory !== undefined) {
    data.chatHistory = sanitizeIpMasterChatMessages(
      patch.chatHistory,
    ) as unknown as Prisma.InputJsonValue;
  }
  if (patch.plan !== undefined) data.plan = patch.plan as Prisma.InputJsonValue;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.meta !== undefined) {
    const prev = parseIpMasterMeta(existing.meta) ?? {};
    data.meta = {
      ...prev,
      ...patch.meta,
      workflow: { ...(prev.workflow ?? {}), ...(patch.meta.workflow ?? {}) },
      templateVersions: patch.meta.templateVersions ?? prev.templateVersions,
    } as unknown as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomIpMasterProject.update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

export async function deleteEcomIpMasterProject(userId: string, projectId: string) {
  const row = await prisma.ecomIpMasterProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!row) throw new Error("项目不存在");
  await prisma.ecomIpMasterProject.delete({ where: { id: projectId } });
}

export async function addIpMasterBenchmarkUpload(
  userId: string,
  projectId: string,
  opts: { label: string; buf: Buffer },
): Promise<IpMasterReference> {
  const project = await getEcomIpMasterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf: opts.buf,
    contentType: "image/png",
  });

  const ref: IpMasterReference = {
    id: `benchmark-${Date.now()}`,
    label: opts.label.slice(0, 40) || "基准图",
    role: "benchmark",
    ossUrl,
  };
  await updateEcomIpMasterProject(userId, projectId, {
    references: [ref],
  });
  return ref;
}

export async function saveIpMasterTemplateVersion(
  userId: string,
  projectId: string,
  opts: {
    markdown: string;
    source?: IpMasterTemplateSource;
    json?: Record<string, unknown>;
    setActive?: boolean;
  },
): Promise<EcomIpMasterProjectDto> {
  const project = await getEcomIpMasterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const meta = project.meta ?? {};
  const versions = [...(meta.templateVersions ?? [])];
  const prevVersion = versions[versions.length - 1]?.version;
  const version = bumpIpMasterVersion(prevVersion);
  const hasImage = project.references.length > 0;
  const hasText = Boolean(
    (project.brief as { description?: string } | null)?.description?.trim(),
  );
  let source: IpMasterTemplateSource = opts.source ?? "text";
  if (hasImage && hasText) source = "mixed";
  else if (hasImage) source = "image";

  const entry: IpMasterTemplateVersion = {
    version,
    markdown: opts.markdown.trim().slice(0, 50_000),
    json: opts.json,
    source,
    createdAt: new Date().toISOString(),
  };
  versions.push(entry);

  return updateEcomIpMasterProject(userId, projectId, {
    status: "in_progress",
    meta: {
      ...meta,
      templateVersions: versions,
      workflow: {
        ...(meta.workflow ?? {}),
        activeVersion: opts.setActive !== false ? version : meta.workflow?.activeVersion,
        draftMarkdown: entry.markdown,
        currentStepId: "versions",
      },
    },
  });
}

/** 供手办/VI 载入：返回基准图 + 当前版 Markdown */
export async function resolveIpMasterForDownstream(
  userId: string,
  ipMasterProjectId: string,
  version?: string,
): Promise<{
  references: IpMasterReference[];
  markdown: string;
  version: string;
} | null> {
  const project = await getEcomIpMasterProject(userId, ipMasterProjectId);
  if (!project) return null;
  const meta = project.meta;
  let tpl = getActiveIpMasterTemplate(meta);
  if (version?.trim()) {
    tpl =
      meta?.templateVersions?.find((v) => v.version === version.trim()) ?? tpl;
  }
  if (!tpl?.markdown.trim()) return null;
  return {
    references: project.references,
    markdown: tpl.markdown,
    version: tpl.version,
  };
}
