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
  if (!resolved) throw new Error("IP 母版不存在或尚无已保存模板");

  const refs: HandCraftReference[] = resolved.references.map((r, i) => ({
    id: `ip-master-${Date.now()}-${i}`,
    label: r.label || "IP 母版基准",
    role: "sketch",
    ossUrl: r.ossUrl,
  }));

  return updateEcomHandCraftProject(opts.userId, opts.handCraftProjectId, {
    references: refs.length > 0 ? refs : undefined,
    settings: {
      ipMasterProjectId: opts.ipMasterProjectId,
      ipMasterVersion: resolved.version,
      referenceFromIpMaster: refs.length > 0,
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
  if (!resolved) throw new Error("IP 母版不存在或尚无已保存模板");

  const refs: BrandViReference[] = resolved.references.map((r, i) => ({
    id: `ip-master-${Date.now()}-${i}`,
    label: r.label || "IP 母版基准",
    role: "sketch",
    ossUrl: r.ossUrl,
  }));

  return updateEcomBrandViProject(opts.userId, opts.brandViProjectId, {
    references: refs.length > 0 ? refs : undefined,
    settings: {
      ipMasterProjectId: opts.ipMasterProjectId,
      ipMasterVersion: resolved.version,
      referenceFromIpMaster: refs.length > 0,
    },
  });
}
