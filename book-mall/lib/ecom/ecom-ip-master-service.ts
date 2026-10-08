import { Prisma } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  IP_MASTER_DEFAULT_BRIEF,
  IP_MASTER_DEFAULT_INPUT_MODE,
} from "@/lib/ecom/ecom-ip-master-input-presets";
import {
  isIpMasterTemplateLibraryReady,
  parseIpMasterTemplateJson,
} from "@/lib/ecom/ecom-ip-master-template-schema";
import {
  ipMasterTemplateToMarkdown,
} from "@/lib/ecom/ecom-ip-master-template-render";
import { persistIpMasterLibraryAsset } from "@/lib/ecom/ecom-ip-master-library-asset";
import {
  buildDefaultIpMasterLibraryLabel,
  sanitizeIpMasterLibraryLabel,
} from "@/lib/ecom/ecom-ip-master-library-label";
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
    const refs = sanitizeIpMasterReferences(row.references);
    const tplJson = parseIpMasterTemplateJson(active?.json);
    const importable = isIpMasterTemplateLibraryReady({
      template: tplJson,
      hasBenchmarkImage: refs.length > 0,
    });
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      thumbnailUrl: refs[0]?.ossUrl ?? null,
      activeVersion: active?.version ?? null,
      importable,
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
      brief: {
        description: IP_MASTER_DEFAULT_BRIEF,
        inputMode: IP_MASTER_DEFAULT_INPUT_MODE,
      } as Prisma.InputJsonValue,
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      plan: { steps: {} } as Prisma.InputJsonValue,
      settings: {} as Prisma.InputJsonValue,
      meta: {
        workflow: { currentStepId: "input", inputCommitted: false },
      } as Prisma.InputJsonValue,
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
    meta: { workflow: { inputCommitted: true } },
  });
  return ref;
}

export async function saveIpMasterTemplateVersion(
  userId: string,
  projectId: string,
  opts: {
    template: Record<string, unknown>;
    imagePrompt?: { positive: string; negative?: string };
    libraryLabel?: string;
    source?: IpMasterTemplateSource;
    setActive?: boolean;
  },
): Promise<EcomIpMasterProjectDto> {
  const project = await getEcomIpMasterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  if (project.references.length === 0) {
    throw new Error("保存入库须先有基准图（上传或 AI 生成）");
  }

  const baseUrl = project.references[0]!.ossUrl;
  const mergedRaw = {
    ...opts.template,
    imagePrompt:
      opts.imagePrompt ??
      opts.template.imagePrompt ??
      project.meta?.workflow?.draftImagePrompt,
  };
  const parsed = parseIpMasterTemplateJson(mergedRaw);
  if (!parsed) throw new Error("结构化模板 JSON 无效");
  if (!parsed.imagePrompt?.positive?.trim()) {
    throw new Error("保存入库须包含生图正向提示词");
  }

  const template = {
    ...parsed,
    ipMeta: {
      ...parsed.ipMeta,
      ipId: project.id,
      baseImageUrl: baseUrl,
      version: bumpIpMasterVersion(
        (project.meta?.templateVersions ?? [])[
          (project.meta?.templateVersions ?? []).length - 1
        ]?.version,
      ),
      createTime: new Date().toISOString().slice(0, 10),
    },
  };

  if (
    !isIpMasterTemplateLibraryReady({
      template,
      hasBenchmarkImage: true,
    })
  ) {
    throw new Error("模板须包含完整的刚性/柔性特征");
  }

  const meta = project.meta ?? {};
  const versions = [...(meta.templateVersions ?? [])];
  const version = template.ipMeta.version;
  const hasText = Boolean(
    (project.brief as { description?: string } | null)?.description?.trim(),
  );
  let source: IpMasterTemplateSource = opts.source ?? "image";
  if (hasText) source = "mixed";

  const markdown = ipMasterTemplateToMarkdown(template);
  const defaultLabel = buildDefaultIpMasterLibraryLabel(
    project,
    template.ipMeta.ipName ?? "",
  );
  const label = sanitizeIpMasterLibraryLabel(opts.libraryLabel ?? defaultLabel);
  const entry: IpMasterTemplateVersion = {
    version,
    label,
    markdown,
    json: template as unknown as Record<string, unknown>,
    source,
    createdAt: new Date().toISOString(),
  };
  versions.push(entry);

  const updated = await updateEcomIpMasterProject(userId, projectId, {
    status: "in_progress",
    title:
      label.split("·")[0]?.trim().slice(0, 120) ||
      template.ipMeta.ipName?.slice(0, 120) ||
      project.title?.slice(0, 120) ||
      undefined,
    meta: {
      ...meta,
      templateVersions: versions,
      workflow: {
        ...(meta.workflow ?? {}),
        activeVersion: opts.setActive !== false ? version : meta.workflow?.activeVersion,
        draftMarkdown: markdown,
        draftTemplate: template as unknown as Record<string, unknown>,
        draftImagePrompt: template.imagePrompt,
        currentStepId: "versions",
      },
    },
  });

  await persistIpMasterLibraryAsset({
    userId,
    projectId,
    entry,
    benchmarkUrl: baseUrl,
    imagePromptPositive: template.imagePrompt?.positive,
  });

  return updated;
}

/** 供手办/VI 母版库导入：须基准图 + 结构化 JSON 版本 */
export async function resolveIpMasterForDownstream(
  userId: string,
  ipMasterProjectId: string,
  version?: string,
): Promise<{
  references: IpMasterReference[];
  template: import("@/lib/ecom/ecom-ip-master-template-schema").IpMasterTemplate;
  markdown: string;
  version: string;
} | null> {
  const project = await getEcomIpMasterProject(userId, ipMasterProjectId);
  if (!project) return null;
  if (project.references.length === 0) return null;

  const meta = project.meta;
  let tpl = getActiveIpMasterTemplate(meta);
  if (version?.trim()) {
    tpl =
      meta?.templateVersions?.find((v) => v.version === version.trim()) ?? tpl;
  }
  if (!tpl) return null;

  const template = parseIpMasterTemplateJson(tpl.json);
  if (
    !isIpMasterTemplateLibraryReady({
      template,
      hasBenchmarkImage: project.references.length > 0,
    })
  ) {
    return null;
  }

  const markdown =
    tpl.markdown?.trim() || (template ? ipMasterTemplateToMarkdown(template) : "");
  if (!markdown.trim()) return null;

  return {
    references: project.references,
    template: template!,
    markdown,
    version: tpl.version,
  };
}
