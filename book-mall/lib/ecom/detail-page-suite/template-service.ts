import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { ECOM_PLATFORM_SPECS } from "@/lib/ecom/ecom-platform-spec";
import { prisma } from "@/lib/prisma";

import { CATEGORY_SEED_META } from "./category-seeds";
import { parseModulesJson } from "./parse";
import type { DetailPageSuiteModuleDef, DetailPageSuiteTemplateDto } from "./types";

function rowToDto(row: {
  id: string;
  platformCode: string;
  categoryKey: string;
  templateName: string;
  categoryLabel: string;
  type: string;
  status: string;
  remark: string | null;
  modules: unknown;
  userId: string | null;
  createUser: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DetailPageSuiteTemplateDto {
  return {
    id: row.id,
    platformCode: row.platformCode,
    categoryKey: row.categoryKey,
    templateName: row.templateName,
    categoryLabel: row.categoryLabel,
    type: row.type === "user" ? "user" : "system",
    status: row.status === "disable" ? "disable" : "enable",
    remark: row.remark,
    modules: parseModulesJson(row.modules),
    userId: row.userId,
    createUser: row.createUser,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDetailPageSuiteTemplates(opts?: {
  platformCode?: string;
  categoryKey?: string;
  type?: "system" | "user";
  includeDisabled?: boolean;
  userId?: string;
}): Promise<DetailPageSuiteTemplateDto[]> {
  const rows = await prisma.ecomDetailPageSuiteTemplate.findMany({
    where: {
      deletedAt: null,
      ...(opts?.platformCode ? { platformCode: opts.platformCode } : {}),
      ...(opts?.categoryKey ? { categoryKey: opts.categoryKey } : {}),
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.includeDisabled ? {} : { status: "enable" }),
      ...(opts?.userId
        ? { OR: [{ type: "system" }, { type: "user", userId: opts.userId }] }
        : {}),
    },
    orderBy: [{ platformCode: "asc" }, { categoryKey: "asc" }, { updatedAt: "desc" }],
  });
  return rows.map(rowToDto);
}

export async function getDetailPageSuiteTemplate(
  id: string,
): Promise<DetailPageSuiteTemplateDto | null> {
  const row = await prisma.ecomDetailPageSuiteTemplate.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToDto(row) : null;
}

export async function listEnabledTemplatesForUser(opts: {
  userId: string;
  platformCode?: string;
}): Promise<DetailPageSuiteTemplateDto[]> {
  return listDetailPageSuiteTemplates({
    platformCode: opts.platformCode,
    userId: opts.userId,
    includeDisabled: false,
  });
}

function validateModules(modules: DetailPageSuiteModuleDef[]): string | null {
  if (modules.length === 0) return "至少保留 1 个大模块";
  const ids = new Set<string>();
  for (const m of modules) {
    if (!m.module_id.trim() || !m.module_name.trim()) return "模块 ID 与名称不能为空";
    if (ids.has(m.module_id)) return `模块 ID 重复：${m.module_id}`;
    ids.add(m.module_id);
    if (m.max_num < 1) return `${m.module_name} 最大数量不能小于 1`;
    if (m.candidate_pool.length === 0) return `${m.module_name} 子维度列表不能为空`;
    if (m.candidate_pool.some((x) => !x.trim())) return "子维度文本不能为空";
    const uniq = new Set(m.candidate_pool.map((x) => x.trim()));
    if (uniq.size !== m.candidate_pool.length) return `${m.module_name} 子维度不能重复`;
  }
  return null;
}

export async function upsertSystemTemplates(): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const spec of ECOM_PLATFORM_SPECS) {
    for (const [categoryKey, meta] of Object.entries(CATEGORY_SEED_META)) {
      const existing = await prisma.ecomDetailPageSuiteTemplate.findFirst({
        where: {
          platformCode: spec.code,
          categoryKey,
          type: "system",
          deletedAt: null,
        },
      });
      const data = {
        platformCode: spec.code,
        categoryKey,
        templateName: `${meta.templateName}（${spec.label}）`,
        categoryLabel: meta.categoryLabel,
        type: "system",
        status: "enable",
        remark: `系统预置 · ${spec.label} · 宽 ${spec.detailPage.widthPx ?? 750}px`,
        modules: meta.modules as unknown as Prisma.InputJsonValue,
      };
      if (existing) {
        await prisma.ecomDetailPageSuiteTemplate.update({
          where: { id: existing.id },
          data,
        });
        updated += 1;
      } else {
        await prisma.ecomDetailPageSuiteTemplate.create({
          data: { id: `dps_${spec.code}_${categoryKey}`, ...data },
        });
        created += 1;
      }
    }
  }
  return { created, updated };
}

export async function createUserTemplate(input: {
  userId: string;
  platformCode: string;
  categoryKey: string;
  templateName: string;
  categoryLabel?: string;
  remark?: string;
  modules: DetailPageSuiteModuleDef[];
}): Promise<DetailPageSuiteTemplateDto> {
  const err = validateModules(input.modules);
  if (err) throw new Error(err);
  const spec = ECOM_PLATFORM_SPECS.find((p) => p.code === input.platformCode);
  const row = await prisma.ecomDetailPageSuiteTemplate.create({
    data: {
      id: randomUUID(),
      platformCode: input.platformCode,
      categoryKey: input.categoryKey,
      templateName: input.templateName.trim().slice(0, 80),
      categoryLabel: input.categoryLabel?.trim() || spec?.label || input.categoryKey,
      type: "user",
      status: "enable",
      remark: input.remark?.trim() || null,
      modules: input.modules as unknown as Prisma.InputJsonValue,
      userId: input.userId,
      createUser: input.userId,
    },
  });
  return rowToDto(row);
}

export async function copyTemplate(opts: {
  sourceId: string;
  userId?: string;
  asUser?: boolean;
  templateName?: string;
  modules?: DetailPageSuiteModuleDef[];
}): Promise<DetailPageSuiteTemplateDto> {
  const source = await getDetailPageSuiteTemplate(opts.sourceId);
  if (!source) throw new Error("模板不存在");
  const modules = opts.modules ?? source.modules;
  if (opts.modules) {
    const err = validateModules(opts.modules);
    if (err) throw new Error(err);
  }
  const asUser = opts.asUser !== false;
  const row = await prisma.ecomDetailPageSuiteTemplate.create({
    data: {
      id: randomUUID(),
      platformCode: source.platformCode,
      categoryKey: source.categoryKey,
      templateName: (opts.templateName?.trim() || `${source.templateName} 副本`).slice(0, 80),
      categoryLabel: source.categoryLabel,
      type: asUser ? "user" : "system",
      status: "enable",
      remark: source.remark,
      modules: modules as unknown as Prisma.InputJsonValue,
      userId: asUser ? (opts.userId ?? null) : null,
      createUser: opts.userId ?? "admin",
    },
  });
  return rowToDto(row);
}

export async function updateTemplate(
  id: string,
  patch: Partial<{
    templateName: string;
    categoryLabel: string;
    categoryKey: string;
    platformCode: string;
    status: "enable" | "disable";
    remark: string | null;
    modules: DetailPageSuiteModuleDef[];
  }>,
  opts?: { allowSystem?: boolean },
): Promise<DetailPageSuiteTemplateDto> {
  const existing = await prisma.ecomDetailPageSuiteTemplate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.type === "system" && !opts?.allowSystem) {
    throw new Error("系统预置模板不可直接编辑，请先复制");
  }
  if (patch.modules) {
    const err = validateModules(patch.modules);
    if (err) throw new Error(err);
  }
  const row = await prisma.ecomDetailPageSuiteTemplate.update({
    where: { id },
    data: {
      ...(patch.templateName !== undefined
        ? { templateName: patch.templateName.trim().slice(0, 80) }
        : {}),
      ...(patch.categoryLabel !== undefined ? { categoryLabel: patch.categoryLabel } : {}),
      ...(patch.categoryKey !== undefined ? { categoryKey: patch.categoryKey } : {}),
      ...(patch.platformCode !== undefined ? { platformCode: patch.platformCode } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.remark !== undefined ? { remark: patch.remark } : {}),
      ...(patch.modules
        ? { modules: patch.modules as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
  return rowToDto(row);
}

export async function countProjectsUsingTemplate(templateId: string): Promise<number> {
  return prisma.ecomDetailPageSuiteProject.count({
    where: {
      OR: [
        { meta: { path: ["templateId"], equals: templateId } },
        { suite: { path: ["templateId"], equals: templateId } },
      ],
    },
  });
}

export async function deleteUserTemplate(id: string): Promise<{ referenced: number }> {
  const existing = await prisma.ecomDetailPageSuiteTemplate.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.type === "system") throw new Error("系统预置模板不可删除");
  const referenced = await countProjectsUsingTemplate(id);
  await prisma.ecomDetailPageSuiteTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), status: "disable" },
  });
  return { referenced };
}

export async function importUserTemplate(input: {
  userId?: string;
  payload: unknown;
}): Promise<DetailPageSuiteTemplateDto> {
  if (!input.payload || typeof input.payload !== "object") {
    throw new Error("JSON解析失败，模板结构不符合规范，请检查文件");
  }
  const o = input.payload as Record<string, unknown>;
  const modules = parseModulesJson(o.modules);
  const err = validateModules(modules);
  if (err) throw new Error(err);
  const platformCode = String(o.platformCode ?? o.platform_code ?? "taobao-tmall");
  return createUserTemplate({
    userId: input.userId ?? "",
    platformCode,
    categoryKey: String(o.categoryKey ?? o.category_key ?? "custom"),
    templateName: String(o.templateName ?? o.template_name ?? "导入模板"),
    categoryLabel: typeof o.categoryLabel === "string" ? o.categoryLabel : undefined,
    remark: typeof o.remark === "string" ? o.remark : undefined,
    modules,
  });
}
