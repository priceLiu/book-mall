import type {
  AssetVisibility,
  Prisma,
  ProjectAssetKind,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getActiveTenantContext } from "@/lib/tenant/context";
import { assertTenantPermission } from "@/lib/tenant/permission";
import type { TenantContext } from "@/lib/tenant/context";
import {
  listLegacyProjectAssets,
  type LegacyListOpts,
} from "./project-asset-legacy-list";
import type {
  CreateProjectAssetInput,
  ListProjectAssetsFilter,
  ProjectAssetRecord,
  ProjectAssetRefRecord,
} from "./project-asset-types";
import { PROJECT_ASSET_LEASE_TTL_MS } from "./project-asset-types";
import {
  collectLayoutNodeMediaItems,
  defaultRefSlotForKind,
  enrichAssetMediaDisplay,
  resolveAssetMediaUrl,
} from "./project-asset-media-resolve";

export class ProjectAssetError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "LOCKED"
      | "EDIT_LEASE_HELD"
      | "FORBIDDEN"
      | "PAYLOAD_TOO_LARGE",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "ProjectAssetError";
  }
}

const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

function toRefRecord(row: {
  id: string;
  slotKey: string;
  label: string;
  mediaUrl: string;
  mimeType: string | null;
  meta: unknown;
  sortOrder: number;
}): ProjectAssetRefRecord {
  return {
    id: row.id,
    slotKey: row.slotKey,
    label: row.label,
    mediaUrl: row.mediaUrl,
    mimeType: row.mimeType,
    meta:
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : null,
    sortOrder: row.sortOrder,
  };
}

function toRecord(row: {
  id: string;
  tenantId: string | null;
  ownerUserId: string;
  visibility: AssetVisibility;
  kind: ProjectAssetKind;
  displayName: string;
  description: string;
  thumbnailUrl: string;
  sourceProjectId: string | null;
  sourceNodeId: string | null;
  sourceEdition: string | null;
  locked: boolean;
  editLockUserId: string | null;
  editLockExpiresAt: Date | null;
  version: number;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
  refs: Parameters<typeof toRefRecord>[0][];
}): ProjectAssetRecord {
  return enrichAssetMediaDisplay({
    id: row.id,
    tenantId: row.tenantId,
    ownerUserId: row.ownerUserId,
    visibility: row.visibility,
    kind: row.kind,
    displayName: row.displayName,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl,
    sourceProjectId: row.sourceProjectId,
    sourceNodeId: row.sourceNodeId,
    sourceEdition: row.sourceEdition,
    locked: row.locked,
    editLockUserId: row.editLockUserId,
    editLockExpiresAt: row.editLockExpiresAt?.toISOString() ?? null,
    version: row.version,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    refs: row.refs.map(toRefRecord),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function resolveProjectAssetTenantContext(
  userId: string,
): Promise<TenantContext> {
  const ctx = await getActiveTenantContext(userId);
  if (!ctx) {
    throw new ProjectAssetError(
      "FORBIDDEN",
      "无法解析当前空间，请重新登录",
      403,
    );
  }
  return ctx;
}

function buildProjectAssetWhere(
  ctx: TenantContext,
  filter: ListProjectAssetsFilter,
): Prisma.ProjectAssetWhereInput {
  const visibilityBase: Prisma.ProjectAssetWhereInput =
    ctx.tenantType === "PERSONAL"
      ? {
          ownerUserId: ctx.actorUserId,
          OR: [{ tenantId: null }, { tenantId: ctx.tenantId }],
        }
      : {
          tenantId: ctx.tenantId,
          OR: [{ visibility: "TEAM_PUBLIC" }, { ownerUserId: ctx.actorUserId }],
        };

  const base: Prisma.ProjectAssetWhereInput = {
    deletedAt: null,
    ...visibilityBase,
  };

  if (filter.kind) base.kind = filter.kind;

  if (filter.visibility && filter.visibility !== "all") {
    base.visibility = filter.visibility;
  }

  const projectId = filter.projectId?.trim() || null;
  const andClauses: Prisma.ProjectAssetWhereInput[] = [];

  if (filter.scope === "project" && projectId) {
    base.sourceProjectId = projectId;
  } else if (filter.scope === "library") {
    base.sourceProjectId = null;
  } else if (projectId) {
    andClauses.push({
      OR: [{ sourceProjectId: projectId }, { sourceProjectId: null }],
    });
  }

  const q = filter.search?.trim();
  if (q) {
    andClauses.push({
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (andClauses.length) {
    base.AND = andClauses;
  }

  return base;
}

export async function listProjectAssets(
  userId: string,
  filter: ListProjectAssetsFilter = {},
): Promise<ProjectAssetRecord[]> {
  const ctx = await resolveProjectAssetTenantContext(userId);
  const rows = await prisma.projectAsset.findMany({
    where: buildProjectAssetWhere(ctx, filter),
    include: { refs: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  const unified = rows.map(toRecord);

  if (filter.includeLegacy !== false) {
    const legacyOpts: LegacyListOpts = {
      userId,
      projectId: filter.projectId ?? null,
      kind: filter.kind ?? null,
    };
    const legacy = await listLegacyProjectAssets(legacyOpts);
    const migratedLegacyIds = new Set(
      unified
        .map((a) => a.payload.legacyId)
        .filter((id): id is string => typeof id === "string"),
    );
    for (const item of legacy) {
      if (item.payload.legacyId && migratedLegacyIds.has(String(item.payload.legacyId))) {
        continue;
      }
      if (filter.kind && item.kind !== filter.kind) continue;
      unified.push(item);
    }
    unified.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  return unified.slice(0, 300);
}

export async function getProjectAsset(
  userId: string,
  assetId: string,
): Promise<ProjectAssetRecord> {
  const ctx = await resolveProjectAssetTenantContext(userId);
  const row = await prisma.projectAsset.findFirst({
    where: {
      id: assetId,
      deletedAt: null,
      ...(ctx.tenantType === "PERSONAL"
        ? { ownerUserId: ctx.actorUserId }
        : {
            tenantId: ctx.tenantId,
            OR: [{ visibility: "TEAM_PUBLIC" }, { ownerUserId: ctx.actorUserId }],
          }),
    },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!row) {
    throw new ProjectAssetError("NOT_FOUND", "资产不存在", 404);
  }
  return toRecord(row);
}

function assertPayloadSize(payload: Record<string, unknown>): void {
  const size = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (size > MAX_PAYLOAD_BYTES) {
    throw new ProjectAssetError(
      "PAYLOAD_TOO_LARGE",
      `资产内容过大（${Math.round(size / 1024)}KB），请拆组后保存`,
      413,
    );
  }
}

function normalizeVisibility(
  ctx: TenantContext,
  visibility?: AssetVisibility,
): AssetVisibility {
  if (ctx.tenantType === "PERSONAL") return "PRIVATE";
  if (visibility === "TEAM_PUBLIC") return "TEAM_PUBLIC";
  return "PRIVATE";
}

export async function createProjectAsset(
  userId: string,
  input: CreateProjectAssetInput,
): Promise<ProjectAssetRecord> {
  const ctx = await resolveProjectAssetTenantContext(userId);
  const displayName = input.displayName?.trim();
  if (!displayName) {
    throw new ProjectAssetError("INVALID_INPUT", "名称不能为空");
  }

  const payload = input.payload ?? {};
  assertPayloadSize(payload);

  const visibility = normalizeVisibility(ctx, input.visibility);
  if (visibility === "TEAM_PUBLIC") {
    assertTenantPermission(ctx, "asset:use");
  }

  let refs = [...(input.refs ?? [])];
  let thumbnailUrl = resolveAssetMediaUrl({
    thumbnailUrl: input.thumbnailUrl,
    refs,
    payload: payload as Record<string, unknown>,
    kind: input.kind,
    displayName,
  });

  if (!refs.length && thumbnailUrl) {
    refs = [
      {
        slotKey: defaultRefSlotForKind(input.kind),
        mediaUrl: thumbnailUrl,
        mimeType:
          input.kind === "STORYBOARD_VIDEO" ? "video/*" : undefined,
      },
    ];
  }

  if (input.kind === "GROUP_BUNDLE") {
    const layoutItems = collectLayoutNodeMediaItems(
      payload as Record<string, unknown>,
    );
    if (layoutItems.length > 0) {
      const seen = new Set(
        refs
          .map((r) => r.mediaUrl.trim())
          .filter((u) => /^https?:\/\//.test(u)),
      );
      for (const item of layoutItems) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        refs.push({
          slotKey: item.id,
          label: item.label,
          mediaUrl: item.url,
        });
      }
      if (!thumbnailUrl) thumbnailUrl = layoutItems[0]!.url;
    }
  }

  const row = await prisma.projectAsset.create({
    data: {
      tenantId: ctx.tenantId,
      ownerUserId: ctx.actorUserId,
      visibility,
      kind: input.kind,
      displayName,
      description: input.description?.trim() ?? "",
      thumbnailUrl,
      sourceProjectId: input.sourceProjectId ?? null,
      sourceNodeId: input.sourceNodeId ?? null,
      sourceEdition: input.sourceEdition ?? null,
      payload: payload as Prisma.InputJsonValue,
      refs: {
        create: refs.map((r, i) => ({
          slotKey: r.slotKey,
          label: r.label ?? "",
          mediaUrl: r.mediaUrl,
          mimeType: r.mimeType ?? null,
          meta: (r.meta ?? undefined) as Prisma.InputJsonValue | undefined,
          sortOrder: r.sortOrder ?? i,
        })),
      },
    },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });

  return toRecord(row);
}

export async function patchProjectAsset(
  userId: string,
  assetId: string,
  patch: {
    displayName?: string;
    description?: string;
    visibility?: AssetVisibility;
    locked?: boolean;
    payload?: Record<string, unknown>;
  },
): Promise<ProjectAssetRecord> {
  const ctx = await resolveProjectAssetTenantContext(userId);
  const existing = await prisma.projectAsset.findFirst({
    where: {
      id: assetId,
      deletedAt: null,
      ...(ctx.tenantType === "PERSONAL"
        ? { ownerUserId: ctx.actorUserId }
        : {
            tenantId: ctx.tenantId,
            OR: [{ visibility: "TEAM_PUBLIC" }, { ownerUserId: ctx.actorUserId }],
          }),
    },
  });
  if (!existing) {
    throw new ProjectAssetError("NOT_FOUND", "资产不存在", 404);
  }

  const isOwner = existing.ownerUserId === ctx.actorUserId;
  if (patch.visibility !== undefined || patch.locked !== undefined) {
    if (!isOwner && existing.visibility === "TEAM_PUBLIC") {
      assertTenantPermission(ctx, "asset:manage_public");
    } else if (!isOwner) {
      throw new ProjectAssetError("FORBIDDEN", "无权修改他人私有资产", 403);
    }
  }

  if (patch.payload) assertPayloadSize(patch.payload);

  if (patch.visibility === "TEAM_PUBLIC" && ctx.tenantType !== "TEAM") {
    throw new ProjectAssetError("INVALID_INPUT", "个人空间无法设为团队共享");
  }

  const row = await prisma.projectAsset.update({
    where: { id: assetId },
    data: {
      displayName: patch.displayName?.trim() || undefined,
      description: patch.description?.trim(),
      visibility: patch.visibility,
      locked: patch.locked,
      payload: patch.payload
        ? (patch.payload as Prisma.InputJsonValue)
        : undefined,
      version: patch.payload ? { increment: 1 } : undefined,
    },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });

  return toRecord(row);
}

export async function deleteProjectAsset(
  userId: string,
  assetId: string,
): Promise<{ ossUrls: string[] }> {
  const ctx = await resolveProjectAssetTenantContext(userId);
  const existing = await prisma.projectAsset.findFirst({
    where: {
      id: assetId,
      deletedAt: null,
      ...(ctx.tenantType === "PERSONAL"
        ? { ownerUserId: ctx.actorUserId }
        : {
            tenantId: ctx.tenantId,
            OR: [{ visibility: "TEAM_PUBLIC" }, { ownerUserId: ctx.actorUserId }],
          }),
    },
    include: { refs: true },
  });
  if (!existing) {
    throw new ProjectAssetError("NOT_FOUND", "资产不存在", 404);
  }

  const isOwner = existing.ownerUserId === ctx.actorUserId;
  if (existing.visibility === "TEAM_PUBLIC") {
    if (!isOwner) assertTenantPermission(ctx, "asset:manage_public");
  } else if (!isOwner) {
    throw new ProjectAssetError("FORBIDDEN", "无权删除他人私有资产", 403);
  }

  const ossUrls = [
    existing.thumbnailUrl,
    ...existing.refs.map((r) => r.mediaUrl),
  ].filter(Boolean);

  await prisma.projectAsset.update({
    where: { id: assetId },
    data: { deletedAt: new Date() },
  });

  return { ossUrls };
}

function leaseActive(row: {
  editLockUserId: string | null;
  editLockExpiresAt: Date | null;
}): boolean {
  if (!row.editLockUserId || !row.editLockExpiresAt) return false;
  return row.editLockExpiresAt.getTime() > Date.now();
}

function canTenantForceLease(
  ctx: TenantContext,
  ownerUserId: string,
): boolean {
  if (ctx.actorUserId === ownerUserId) return true;
  return ctx.role === "OWNER" || ctx.role === "ADMIN";
}

export async function acquireProjectAssetLease(
  userId: string,
  assetId: string,
  opts?: { force?: boolean },
): Promise<ProjectAssetRecord> {
  const ctx = await resolveProjectAssetTenantContext(userId);
  const existing = await prisma.projectAsset.findFirst({
    where: {
      id: assetId,
      deletedAt: null,
      ...(ctx.tenantType === "PERSONAL"
        ? { ownerUserId: ctx.actorUserId }
        : {
            tenantId: ctx.tenantId,
            OR: [{ visibility: "TEAM_PUBLIC" }, { ownerUserId: ctx.actorUserId }],
          }),
    },
  });
  if (!existing) {
    throw new ProjectAssetError("NOT_FOUND", "资产不存在", 404);
  }

  if (leaseActive(existing) && existing.editLockUserId !== ctx.actorUserId) {
    if (!opts?.force) {
      throw new ProjectAssetError(
        "EDIT_LEASE_HELD",
        "其他成员正在编辑此资产",
        409,
      );
    }
    if (!canTenantForceLease(ctx, existing.ownerUserId)) {
      throw new ProjectAssetError("FORBIDDEN", "无权接管编辑", 403);
    }
  }

  const expires = new Date(Date.now() + PROJECT_ASSET_LEASE_TTL_MS);
  const row = await prisma.projectAsset.update({
    where: { id: assetId },
    data: {
      editLockUserId: ctx.actorUserId,
      editLockExpiresAt: expires,
    },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  return toRecord(row);
}

export async function releaseProjectAssetLease(
  userId: string,
  assetId: string,
): Promise<void> {
  const ctx = await resolveProjectAssetTenantContext(userId);
  const existing = await prisma.projectAsset.findFirst({
    where: { id: assetId, deletedAt: null },
  });
  if (!existing || existing.editLockUserId !== ctx.actorUserId) return;

  await prisma.projectAsset.update({
    where: { id: assetId },
    data: { editLockUserId: null, editLockExpiresAt: null },
  });
}

export async function heartbeatProjectAssetLease(
  userId: string,
  assetId: string,
): Promise<ProjectAssetRecord> {
  return acquireProjectAssetLease(userId, assetId);
}
