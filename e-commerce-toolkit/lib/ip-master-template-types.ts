import {
  emptyOfficialFlexibleFeatures,
  syncTemplateFlexibleFeatures,
} from "@/lib/ip-master-flexible-official";

export type IpMasterRigidFeature = {
  featureName: string;
  description: string;
  weight: number;
};

export type IpMasterFlexibleFeature = {
  featureName: string;
  description: string;
};

export type IpMasterImagePrompt = {
  positive: string;
  negative?: string;
};

export type IpMasterRegenerateTarget = "both" | "imagePrompt" | "structured";

export type IpMasterTemplate = {
  schemaVersion?: number;
  imagePrompt?: IpMasterImagePrompt;
  ipMeta: {
    ipId: string;
    ipName: string;
    version: string;
    createTime: string;
    baseImageUrl?: string;
    styleSummary?: string;
  };
  rigidFeatures: IpMasterRigidFeature[];
  flexibleFeatures: IpMasterFlexibleFeature[];
  softConstraint: string;
  exceptionRule?: string;
  characterSummary?: string;
  pendingItems?: string[];
};

export const IP_MASTER_BRIEF_PLACEHOLDER =
  "用大白话写即可，可只写 IP 名 + 风格；也可补充：圆脸蛋、大耳朵、3头身…";

export function emptyIpMasterDraftTemplate(projectId: string): IpMasterTemplate {
  return {
    schemaVersion: 1,
    ipMeta: {
      ipId: projectId,
      ipName: "未命名 IP",
      version: "V0.1",
      createTime: new Date().toISOString().slice(0, 10),
      baseImageUrl: "",
      styleSummary: "",
    },
    rigidFeatures: [],
    flexibleFeatures: emptyOfficialFlexibleFeatures(),
    softConstraint: "",
    exceptionRule: "",
    characterSummary: "",
    pendingItems: [],
  };
}

export function readDraftImagePromptFromProject(project: {
  meta?: {
    workflow?: { draftImagePrompt?: IpMasterImagePrompt; draftTemplate?: unknown };
    templateVersions?: Array<{ json?: unknown }>;
  } | null;
}): IpMasterImagePrompt | undefined {
  const fromWorkflow = project.meta?.workflow?.draftImagePrompt;
  if (fromWorkflow?.positive?.trim()) return fromWorkflow;
  const raw =
    project.meta?.workflow?.draftTemplate ??
    project.meta?.templateVersions?.[project.meta.templateVersions.length - 1]?.json;
  if (raw && typeof raw === "object") {
    const ip = (raw as IpMasterTemplate).imagePrompt;
    if (ip?.positive?.trim()) return ip;
  }
  return undefined;
}

export function readDraftTemplateFromProject(project: {
  id: string;
  meta?: {
    workflow?: { draftTemplate?: unknown; draftImagePrompt?: IpMasterImagePrompt };
    templateVersions?: Array<{ json?: unknown }>;
  } | null;
  references: Array<{ ossUrl: string }>;
}): IpMasterTemplate {
  const raw =
    project.meta?.workflow?.draftTemplate ??
    project.meta?.templateVersions?.[project.meta.templateVersions.length - 1]?.json;
  if (raw && typeof raw === "object") {
    let t = { ...(raw as IpMasterTemplate) };
    const prompt = readDraftImagePromptFromProject(project);
    if (prompt && !t.imagePrompt?.positive?.trim()) {
      t.imagePrompt = prompt;
    }
    t = syncTemplateFlexibleFeatures(t);
    return t;
  }
  const t = emptyIpMasterDraftTemplate(project.id);
  if (project.references[0]?.ossUrl) {
    t.ipMeta.baseImageUrl = project.references[0].ossUrl;
  }
  return t;
}
