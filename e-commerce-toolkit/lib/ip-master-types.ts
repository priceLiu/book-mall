export type IpMasterStepId = "input" | "review" | "versions" | "extract";

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

export type IpMasterTemplateVersion = {
  version: string;
  label?: string;
  markdown: string;
  json?: Record<string, unknown>;
  source: "image" | "text" | "mixed";
  createdAt: string;
};

export type IpMasterSettings = {
  chatModelKey?: string;
};

export type IpMasterMeta = {
  workflow?: {
    currentStepId?: IpMasterStepId;
    activeVersion?: string;
    draftMarkdown?: string;
    draftTemplate?: Record<string, unknown>;
    draftImagePrompt?: { positive: string; negative?: string };
    inputCommitted?: boolean;
  };
  templateVersions?: IpMasterTemplateVersion[];
};

export type IpMasterProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: IpMasterSettings;
  references: IpMasterReference[];
  chatHistory: IpMasterChatMessage[];
  plan: Record<string, unknown>;
  meta: IpMasterMeta | null;
  createdAt: string;
  updatedAt: string;
};

export type IpMasterModelsPayload = {
  chatModels: import("@/lib/storyboard-types").StoryboardGatewayModel[];
  defaultChatModelKey: string;
  defaultVisionChatModelKey?: string;
};
