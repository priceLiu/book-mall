import { z } from "zod";

export const ECOM_IP_MASTER_TOOL_KEY = "ecom-toolkit__ip";
export const ECOM_IP_MASTER_MODULE = "ip-master";

export const IP_MASTER_BENCHMARK_MAX = 1;

export type IpMasterChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type IpMasterReference = {
  id: string;
  label: string;
  role: "benchmark";
  ossUrl: string;
};

export type IpMasterTemplateSource = "image" | "text" | "mixed";

export type IpMasterTemplateVersion = {
  version: string;
  markdown: string;
  json?: Record<string, unknown>;
  source: IpMasterTemplateSource;
  createdAt: string;
};

export type IpMasterSettings = {
  chatModelKey?: string;
};

export type IpMasterMeta = {
  workflow?: {
    currentStepId?: string;
    activeVersion?: string;
    draftMarkdown?: string;
  };
  templateVersions?: IpMasterTemplateVersion[];
  workflowSnapshot?: unknown;
  workflowSnapshotHistory?: unknown[];
  reusedFrom?: { savedAt: string; title: string; at: string };
};

export type IpMasterPlan = {
  steps?: Record<string, { updatedAt?: string }>;
};

const refSchema = z.object({
  id: z.string().min(1),
  label: z.string().default(""),
  role: z.literal("benchmark"),
  ossUrl: z.string().url(),
});

export function sanitizeIpMasterReferences(input: unknown): IpMasterReference[] {
  if (!Array.isArray(input)) return [];
  const out: IpMasterReference[] = [];
  for (const item of input) {
    const parsed = refSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out.slice(0, IP_MASTER_BENCHMARK_MAX);
}

export function sanitizeIpMasterChatMessages(input: unknown): IpMasterChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: IpMasterChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.role !== "user" && o.role !== "assistant") continue;
    const content = typeof o.content === "string" ? o.content : "";
    if (!content.trim()) continue;
    out.push({
      id: typeof o.id === "string" ? o.id : `msg-${out.length}`,
      role: o.role,
      content,
      createdAt:
        typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

export function parseIpMasterMeta(input: unknown): IpMasterMeta | null {
  if (!input || typeof input !== "object") return null;
  return input as IpMasterMeta;
}

export function parseIpMasterPlan(input: unknown): IpMasterPlan {
  if (!input || typeof input !== "object") return { steps: {} };
  const steps = (input as IpMasterPlan).steps;
  return { steps: steps && typeof steps === "object" ? steps : {} };
}

/** Skill §七 兜底 + 模板正文 */
export function buildIpMasterConstraintBlock(markdown: string | undefined | null): string {
  const body = markdown?.trim();
  if (!body) return "";
  const preamble =
    "严格以 IP 母版模板为唯一角色基准：刚性锚点（标志性轮廓特征、脸型轮廓、五官相对排布、头身比）不可改动；柔性可变项（发色、肤色、服饰、表情动作）可按本次需求自由变更；柔性项变更不得破坏角色整体气质风格；特例放行规则列明的情况除外。";
  return `\n\n【IP 母版约束】\n${preamble}\n\n${body}`;
}

export function bumpIpMasterVersion(prev: string | undefined): string {
  const raw = (prev ?? "V0.0").replace(/^V/i, "");
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return "V1.0";
  const next = Math.round((n + 0.1) * 10) / 10;
  return `V${next.toFixed(1)}`;
}

export function getActiveIpMasterTemplate(
  meta: IpMasterMeta | null | undefined,
): IpMasterTemplateVersion | null {
  const versions = meta?.templateVersions ?? [];
  if (versions.length === 0) return null;
  const active = meta?.workflow?.activeVersion?.trim();
  if (active) {
    const hit = versions.find((v) => v.version === active);
    if (hit) return hit;
  }
  return versions[versions.length - 1] ?? null;
}
