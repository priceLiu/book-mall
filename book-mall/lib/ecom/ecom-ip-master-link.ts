import { updateEcomBrandViProject } from "@/lib/ecom/ecom-brand-vi-service";
import type { BrandViReference } from "@/lib/ecom/ecom-brand-vi-types";
import { updateEcomHandCraftProject } from "@/lib/ecom/ecom-hand-craft-service";
import type { HandCraftReference } from "@/lib/ecom/ecom-hand-craft-types";
import { resolveIpMasterForDownstream } from "@/lib/ecom/ecom-ip-master-service";

export async function linkIpMasterToHandCraftProject(opts: {
  userId: string;
  handCraftProjectId: string;
  ipMasterProjectId: string;
  version?: string;
}) {
  const resolved = await resolveIpMasterForDownstream(
    opts.userId,
    opts.ipMasterProjectId,
    opts.version,
  );
  if (!resolved) {
    throw new Error("母版库条目须含基准图与已保存的结构化模板版本");
  }
  if (resolved.references.length === 0) {
    throw new Error("该母版缺少基准图，无法导入");
  }

  const refs: HandCraftReference[] = resolved.references.map((r, i) => ({
    id: `ip-master-${Date.now()}-${i}`,
    label: r.label || "IP 母版基准",
    role: "sketch",
    ossUrl: r.ossUrl,
  }));

  return updateEcomHandCraftProject(opts.userId, opts.handCraftProjectId, {
    references: refs,
    settings: {
      ipMasterProjectId: opts.ipMasterProjectId,
      ipMasterVersion: resolved.version,
      referenceFromIpMaster: true,
    },
  });
}

export async function linkIpMasterToBrandViProject(opts: {
  userId: string;
  brandViProjectId: string;
  ipMasterProjectId: string;
  version?: string;
}) {
  const resolved = await resolveIpMasterForDownstream(
    opts.userId,
    opts.ipMasterProjectId,
    opts.version,
  );
  if (!resolved) {
    throw new Error("母版库条目须含基准图与已保存的结构化模板版本");
  }
  if (resolved.references.length === 0) {
    throw new Error("该母版缺少基准图，无法导入");
  }

  const refs: BrandViReference[] = resolved.references.map((r, i) => ({
    id: `ip-master-${Date.now()}-${i}`,
    label: r.label || "IP 母版基准",
    role: "sketch",
    ossUrl: r.ossUrl,
  }));

  return updateEcomBrandViProject(opts.userId, opts.brandViProjectId, {
    references: refs,
    settings: {
      ipMasterProjectId: opts.ipMasterProjectId,
      ipMasterVersion: resolved.version,
      referenceFromIpMaster: true,
    },
  });
}
