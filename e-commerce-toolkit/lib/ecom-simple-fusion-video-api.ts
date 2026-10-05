import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type SimpleFusionProject = {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: string;
  settings: {
    variant?: string;
    fusionModelKey?: string;
    videoModelKey?: string;
    panelDurationSec?: number;
    bgmPresetId?: string;
  };
  references: {
    model?: { ossUrl: string; label?: string; source?: string };
    scene?: {
      ossUrl?: string;
      scenePrompt?: string;
      libraryEntryId?: string;
      libraryEntryName?: string;
    };
    garments?: Array<{ id: string; ossUrl: string; label?: string }>;
  };
  composeResult: { videoUrl: string; coverUrl?: string } | null;
  meta: {
    prompts?: { fusion?: string; video?: string; negative?: string };
    /** 用户改过融合 Prompt 后为 true；否则随素材自动 @ 引用 */
    promptsCustomized?: boolean;
    /** 用户改过图生视频 Prompt；否则随融合成片自动 @融合N */
    videoPromptCustomized?: boolean;
    looks?: Array<{
      lookId: string;
      garmentId: string;
      fusedImageUrl?: string;
      clipVideoUrl?: string;
      status?: string;
      failReason?: string;
    }>;
    composeWorkbench?: import("@/lib/simple-fusion-compose-workbench").ComposeWorkbenchState;
    renderJobId?: string;
    renderFailReason?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type SimpleFusionProjectSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  phase: string;
};

const BASE = "api/sso/tools/ecom/simple-fusion-video";

export async function listSimpleFusionProjects(
  module: string,
): Promise<SimpleFusionProjectSummary[]> {
  const data = await ecomBookFetch(`${BASE}/projects?module=${encodeURIComponent(module)}`);
  return (data.items ?? []) as SimpleFusionProjectSummary[];
}

export async function createSimpleFusionProject(module: string, title?: string) {
  const data = await ecomBookFetch(`${BASE}/projects`, {
    method: "POST",
    body: JSON.stringify({ module, title }),
  });
  return data.project as SimpleFusionProject;
}

export async function getSimpleFusionProject(id: string) {
  const data = await ecomBookFetch(`${BASE}/projects/${encodeURIComponent(id)}`);
  return data.project as SimpleFusionProject;
}

export async function patchSimpleFusionProject(
  id: string,
  patch: Partial<Pick<SimpleFusionProject, "title" | "settings" | "references" | "meta">>,
) {
  const data = await ecomBookFetch(`${BASE}/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.project as SimpleFusionProject;
}

export async function removeSimpleFusionGarment(projectId: string, garmentId: string) {
  const data = await ecomBookFetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/garments/${encodeURIComponent(garmentId)}`,
    { method: "DELETE" },
  );
  return data.project as SimpleFusionProject;
}

export async function clearSimpleFusionRefSlot(
  projectId: string,
  slot: "model" | "scene",
  current: SimpleFusionProject["references"],
) {
  if (slot === "model") {
    const { model: _m, ...rest } = current;
    return patchSimpleFusionProject(projectId, { references: rest });
  }
  const scene = current.scene;
  if (!scene?.ossUrl) return getSimpleFusionProject(projectId);
  const { ossUrl: _u, ...sceneRest } = scene;
  const nextScene = Object.keys(sceneRest).length ? sceneRest : undefined;
  return patchSimpleFusionProject(projectId, {
    references: { ...current, scene: nextScene },
  });
}

export async function uploadSimpleFusionMedia(
  projectId: string,
  slot: "model" | "scene" | "garment",
  file: File,
) {
  const form = new FormData();
  form.set("file", file);
  form.set("slot", slot);
  form.set("firstOrigin", "user-upload");
  const data = await ecomBookFetch(`${BASE}/projects/${encodeURIComponent(projectId)}/media/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as SimpleFusionProject;
}

export async function generateSimpleFusionModel(projectId: string, prompt: string) {
  const data = await ecomBookFetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/refs/generate-model`,
    { method: "POST", body: JSON.stringify({ prompt }) },
  );
  return data.project as SimpleFusionProject;
}

export async function renderSimpleFusionCompose(
  projectId: string,
  composeWorkbench?: import("@/lib/simple-fusion-compose-workbench").ComposeWorkbenchState,
) {
  const data = await ecomBookFetch(`${BASE}/projects/${encodeURIComponent(projectId)}/render`, {
    method: "POST",
    body: JSON.stringify(composeWorkbench ? { composeWorkbench } : {}),
  });
  return data.project as SimpleFusionProject;
}

export async function generateSimpleFusionComposeClipTts(
  projectId: string,
  clipId: string,
  opts?: { text?: string; voice?: string; modelKey?: string },
) {
  const data = await ecomBookFetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/compose/clips/${encodeURIComponent(clipId)}/tts`,
    {
      method: "POST",
      body: JSON.stringify(opts ?? {}),
    },
  );
  return data.project as SimpleFusionProject;
}

export async function uploadSimpleFusionComposeClipAudio(
  projectId: string,
  clipId: string,
  file: File,
) {
  const form = new FormData();
  form.set("file", file);
  const data = await ecomBookFetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/compose/clips/${encodeURIComponent(clipId)}/audio`,
    { method: "POST", body: form },
  );
  return data.project as SimpleFusionProject;
}

export async function clearSimpleFusionComposeClipAudio(projectId: string, clipId: string) {
  const data = await ecomBookFetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/compose/clips/${encodeURIComponent(clipId)}/audio`,
    { method: "DELETE" },
  );
  return data.project as SimpleFusionProject;
}

export async function uploadSimpleFusionComposeClip(projectId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  form.set("slot", "compose-clip");
  form.set("firstOrigin", "user-upload");
  const data = await ecomBookFetch(`${BASE}/projects/${encodeURIComponent(projectId)}/media/upload`, {
    method: "POST",
    body: form,
  });
  return data.project as SimpleFusionProject;
}

export async function runSimpleFusionGenerate(
  projectId: string,
  step: "fusion" | "video" | "all" | "render" = "all",
  opts?: { lookIds?: string[] },
) {
  const data = await ecomBookFetch(`${BASE}/projects/${encodeURIComponent(projectId)}/generate`, {
    method: "POST",
    body: JSON.stringify({
      step,
      ...(opts?.lookIds?.length ? { lookIds: opts.lookIds } : {}),
    }),
  });
  return data.project as SimpleFusionProject;
}

export async function saveSimpleFusionSnapshot(projectId: string) {
  const data = await ecomBookFetch(
    `${BASE}/projects/${encodeURIComponent(projectId)}/deliverable/snapshot`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return data.project as SimpleFusionProject;
}
