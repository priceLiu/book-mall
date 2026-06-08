/**
 * 资产共享服务（租户体系 · 里程碑 5）
 *
 * 统一处理跨工具资产（图片库 / 视频库 / 电商资产 / 电商分镜 / Story / Canvas 项目）的：
 *   - 可见域过滤（个人空间 = 本人；团队空间 = 团队公共库 + 本人私有库）
 *   - 「设为公共 / 收回私有」（asset:manage_public 校验）
 *   - 离队处置（私有资产 转公共 / 移交 / 删除）
 *
 * 设计见 doc/product/14-tenant-team-design.md §3。
 * 破坏性删除须在「调用方 UI」二次确认（见规则 destructive-delete-confirmation）。
 */
import type { AssetVisibility } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { assertTenantPermission, canTenant } from "./permission";
import type { TenantContext } from "./context";

/** 受管资产模型键（与 prisma delegate 名一致）。 */
export type SharedAssetModel =
  | "textToImageLibraryItem"
  | "imageToVideoLibraryItem"
  | "ecomAsset"
  | "ecomStoryboardProject"
  | "storyProject"
  | "canvasProject";

interface AssetModelMeta {
  /** 该资产的 OSS 主链接字段（删除时供调用方做云端清理；本服务不直接删 OSS）。 */
  urlField: string | null;
  /** 软删字段（存在则离队删除走软删；否则物理删）。 */
  softDeleteField: string | null;
}

const MODEL_META: Record<SharedAssetModel, AssetModelMeta> = {
  textToImageLibraryItem: { urlField: "imageUrl", softDeleteField: null },
  imageToVideoLibraryItem: { urlField: "videoUrl", softDeleteField: null },
  ecomAsset: { urlField: "ossUrl", softDeleteField: null },
  ecomStoryboardProject: { urlField: null, softDeleteField: null },
  storyProject: { urlField: null, softDeleteField: "deletedAt" },
  canvasProject: { urlField: null, softDeleteField: "deletedAt" },
};

function delegate(model: SharedAssetModel) {
  // prisma 客户端按属性名暴露各模型 delegate
  return (prisma as unknown as Record<string, any>)[model];
}

/**
 * 当前空间下「可见资产」的 where 片段（拼接到各列表查询）。
 *  - 个人空间：本人创建（含历史 tenantId=null 或个人租户）。
 *  - 团队空间：本租户的公共库 OR 本人在该租户的私有库。
 */
export function buildVisibleAssetWhere<T extends object = Record<string, unknown>>(
  ctx: TenantContext,
): T {
  if (ctx.tenantType === "PERSONAL") {
    return {
      userId: ctx.actorUserId,
      OR: [{ tenantId: null }, { tenantId: ctx.tenantId }],
    } as unknown as T;
  }
  return {
    tenantId: ctx.tenantId,
    OR: [{ visibility: "TEAM_PUBLIC" }, { ownerUserId: ctx.actorUserId }],
  } as unknown as T;
}

/** 写入新资产时应带的租户字段（在各生成落库处展开）。 */
export function assetOwnershipFields(ctx: TenantContext): {
  tenantId: string;
  ownerUserId: string;
  visibility: AssetVisibility;
} {
  return {
    tenantId: ctx.tenantId,
    ownerUserId: ctx.actorUserId,
    visibility: "PRIVATE",
  };
}

export class AssetAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetAccessError";
  }
}

/**
 * 切换资产可见域（设为公共 / 收回私有）。
 *  - 个人空间不支持公共库（无团队语义）。
 *  - 设为 TEAM_PUBLIC：本人产物可设（asset:use）；他人产物需 asset:manage_public。
 *  - 收回 PRIVATE：资产所有者本人，或 OWNER/ADMIN。
 */
export async function setAssetVisibility(input: {
  ctx: TenantContext;
  model: SharedAssetModel;
  assetId: string;
  visibility: AssetVisibility;
}): Promise<void> {
  const { ctx, model, assetId, visibility } = input;
  if (ctx.tenantType !== "TEAM") {
    throw new AssetAccessError("个人空间无团队公共库");
  }

  const d = delegate(model);
  const asset = await d.findUnique({ where: { id: assetId } });
  if (!asset) throw new AssetAccessError("资产不存在");

  const inTenant = asset.tenantId === ctx.tenantId || asset.userId === ctx.actorUserId;
  if (!inTenant) throw new AssetAccessError("资产不属于当前团队空间");

  const isOwnerOfAsset =
    asset.ownerUserId === ctx.actorUserId || asset.userId === ctx.actorUserId;

  if (visibility === "TEAM_PUBLIC") {
    if (!isOwnerOfAsset) assertTenantPermission(ctx, "asset:manage_public");
  } else {
    if (!isOwnerOfAsset) assertTenantPermission(ctx, "asset:manage_public");
  }

  await d.update({
    where: { id: assetId },
    data: {
      visibility,
      tenantId: ctx.tenantId,
      ownerUserId: asset.ownerUserId ?? asset.userId,
    },
  });
}

/** 移交资产归属（OWNER/ADMIN）。 */
export async function reassignAssetOwner(input: {
  ctx: TenantContext;
  model: SharedAssetModel;
  assetId: string;
  toUserId: string;
}): Promise<void> {
  assertTenantPermission(input.ctx, "asset:manage_public");
  const d = delegate(input.model);
  const asset = await d.findUnique({ where: { id: input.assetId } });
  if (!asset || asset.tenantId !== input.ctx.tenantId) {
    throw new AssetAccessError("资产不属于当前团队空间");
  }
  await d.update({
    where: { id: input.assetId },
    data: { ownerUserId: input.toUserId },
  });
}

export type DepartureDisposition = "TRANSFER_PUBLIC" | "REASSIGN" | "DELETE";

export interface DepartureResult {
  model: SharedAssetModel;
  affected: number;
  ossUrls: string[]; // DELETE 处置时返回，供调用方做云端清理
}

/**
 * 成员离队处置：处理该成员在团队内的「私有」资产。
 *  - TRANSFER_PUBLIC：转为团队公共库（保留原创建者署名）。
 *  - REASSIGN：归属移交给 toUserId（默认 OWNER）。
 *  - DELETE：删除记录并返回 OSS 链接（云端清理由调用方在二次确认后执行）。
 *
 * 公共库资产（TEAM_PUBLIC）不随个人离队处置，仍归团队。
 */
export async function handleMemberDeparture(input: {
  tenantId: string;
  departingUserId: string;
  disposition: DepartureDisposition;
  reassignToUserId?: string | null;
}): Promise<DepartureResult[]> {
  const results: DepartureResult[] = [];

  for (const model of Object.keys(MODEL_META) as SharedAssetModel[]) {
    const meta = MODEL_META[model];
    const d = delegate(model);
    const where = {
      tenantId: input.tenantId,
      ownerUserId: input.departingUserId,
      visibility: "PRIVATE",
    };

    if (input.disposition === "TRANSFER_PUBLIC") {
      const res = await d.updateMany({
        where,
        data: { visibility: "TEAM_PUBLIC" },
      });
      results.push({ model, affected: res.count, ossUrls: [] });
    } else if (input.disposition === "REASSIGN") {
      const to = input.reassignToUserId;
      if (!to) throw new AssetAccessError("移交目标用户缺失");
      const res = await d.updateMany({
        where,
        data: { ownerUserId: to, visibility: "TEAM_PUBLIC" },
      });
      results.push({ model, affected: res.count, ossUrls: [] });
    } else {
      // DELETE：收集 OSS 链接 → 删除记录（软删优先）
      const rows: Array<Record<string, any>> = await d.findMany({ where });
      const ossUrls = meta.urlField
        ? rows.map((r) => r[meta.urlField as string]).filter((u): u is string => !!u)
        : [];
      if (meta.softDeleteField) {
        await d.updateMany({ where, data: { [meta.softDeleteField]: new Date() } });
      } else {
        await d.deleteMany({ where });
      }
      results.push({ model, affected: rows.length, ossUrls });
    }
  }

  return results;
}

export { canTenant };
