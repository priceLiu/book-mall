"use client";

import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import type {
  AspectRatio,
  ComicProject,
  CreateProjectInput,
  ProjectCharacter,
  StoryboardFrame,
} from "./types";

export class BookMallApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number,
  ) {
    super(message);
    this.name = "BookMallApiError";
  }
}

type AvatarTaskStatus = ProjectCharacter["avatarTaskStatus"];
type FrameTaskStatus = StoryboardFrame["imageTaskStatus"];

export type ProjectListItemDto = {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  styleId: number;
  status: ComicProject["status"];
  storyOutline: string;
  coverImageUrl: string;
  styleFallbackUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type CharacterDto = {
  id: string;
  name: string;
  role: string;
  description: string;
  imagePrompt: string;
  avatarUrl: string;
  avatarTaskStatus: AvatarTaskStatus | null;
  sortOrder: number;
};

export type FrameDto = {
  id: string;
  index: number;
  sceneText: string;
  sceneDescription: string;
  characterIds: string[];
  imagePrompt: string;
  videoPrompt: string;
  imageUrl: string;
  videoUrl: string;
  imageTaskStatus: FrameTaskStatus | null;
  videoTaskStatus: FrameTaskStatus | null;
  imageCostMs: number | null;
  videoCostMs: number | null;
  videoModelId: string | null;
};

export type PendingTaskDto = {
  id: string;
  kind: string;
  status: "PENDING" | "SUBMITTED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  characterId: string | null;
  frameId: string | null;
  failCode: string | null;
  failMessage: string | null;
};

export type ProjectDetailDto = ProjectListItemDto & {
  characters: CharacterDto[];
  frames: FrameDto[];
  pendingTasks: PendingTaskDto[];
};

async function callApi<T>(
  base: string,
  apiPath: string,
  init: RequestInit,
): Promise<T> {
  const { url, init: merged } = resolveBookMallBrowserRequest(base, apiPath, init);
  const r = await fetch(url, merged);
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!r.ok) {
    const code =
      (json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : `HTTP_${r.status}`) ?? `HTTP_${r.status}`;
    const message =
      (json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : text || `HTTP ${r.status}`) ?? `HTTP ${r.status}`;
    throw new BookMallApiError(code as string, message as string, r.status);
  }
  return json as T;
}

// —— Projects ——

export async function apiListProjects(base: string): Promise<ProjectListItemDto[]> {
  const data = await callApi<{ projects: ProjectListItemDto[] }>(
    base,
    "/api/story/projects",
    { method: "GET" },
  );
  return data.projects;
}

export async function apiCreateProject(
  base: string,
  input: CreateProjectInput,
): Promise<ProjectListItemDto> {
  const data = await callApi<{ project: ProjectListItemDto }>(
    base,
    "/api/story/projects",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return data.project;
}

export async function apiGetProject(
  base: string,
  id: string,
): Promise<ProjectDetailDto> {
  const data = await callApi<{ project: ProjectDetailDto }>(
    base,
    `/api/story/projects/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
  return data.project;
}

export async function apiPatchProject(
  base: string,
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    aspectRatio: AspectRatio;
    styleId: number;
    status: ComicProject["status"];
    storyOutline: string;
  }>,
): Promise<ProjectListItemDto> {
  const data = await callApi<{ project: ProjectListItemDto }>(
    base,
    `/api/story/projects/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  return data.project;
}

export async function apiDeleteProject(
  base: string,
  id: string,
): Promise<{ projectId: string; cleanupItemCount: number }> {
  return callApi<{ projectId: string; cleanupItemCount: number }>(
    base,
    `/api/story/projects/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

// —— Initialization / AI Pipeline ——

export const STORY_CHARACTER_COUNT_OPTIONS = [3, 5, 8] as const;
export type StoryCharacterCount = (typeof STORY_CHARACTER_COUNT_OPTIONS)[number];

export async function apiInitializeProject(
  base: string,
  id: string,
  args: { characterCount?: StoryCharacterCount } = {},
): Promise<{ project: ProjectDetailDto; newTaskIds: string[] }> {
  return callApi<{ project: ProjectDetailDto; newTaskIds: string[] }>(
    base,
    `/api/story/projects/${encodeURIComponent(id)}/initialize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args ?? {}),
    },
  );
}

export async function apiRegenerateCover(
  base: string,
  projectId: string,
): Promise<{ taskId: string }> {
  return callApi<{ taskId: string }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/cover`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
}

export async function apiRegenerateAvatar(
  base: string,
  projectId: string,
  characterId: string,
): Promise<{ taskId: string }> {
  return callApi<{ taskId: string }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}/avatar`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
}

export const STORYBOARD_FRAME_COUNT_OPTIONS = [3, 5, 8] as const;
export type StoryboardFrameCount = (typeof STORYBOARD_FRAME_COUNT_OPTIONS)[number];

export async function apiGenerateStoryboard(
  base: string,
  projectId: string,
  args: { count: StoryboardFrameCount; force?: boolean },
): Promise<{ project: ProjectDetailDto }> {
  return callApi<{ project: ProjectDetailDto }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/storyboard/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
}

export async function apiSubmitFrameImage(
  base: string,
  projectId: string,
  frameId: string,
): Promise<{ taskId: string }> {
  return callApi<{ taskId: string }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}/image`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
}

export type StoryVideoModelId =
  | "bytedance/seedance-2"
  | "wan/2-7-image-to-video"
  | "happyhorse/image-to-video";

export type StoryVideoOptions = {
  resolution?: string;
  duration?: number;
  generateAudio?: boolean;
  promptExtend?: boolean;
  watermark?: boolean;
};

export async function apiSubmitFrameVideo(
  base: string,
  projectId: string,
  frameId: string,
  args: { modelId?: StoryVideoModelId; options?: StoryVideoOptions } = {},
): Promise<{ taskId: string }> {
  return callApi<{ taskId: string }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}/video`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args ?? {}),
    },
  );
}

export async function apiPatchCharacter(
  base: string,
  projectId: string,
  characterId: string,
  patch: Partial<{ name: string; role: string; description: string; imagePrompt: string }>,
): Promise<{ character: CharacterDto }> {
  return callApi<{ character: CharacterDto }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

export async function apiDeleteCharacter(
  base: string,
  projectId: string,
  characterId: string,
): Promise<{ deleted: true }> {
  return callApi<{ deleted: true }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}`,
    { method: "DELETE" },
  );
}

export async function apiPatchFrame(
  base: string,
  projectId: string,
  frameId: string,
  patch: Partial<{
    sceneText: string;
    sceneDescription: string;
    imagePrompt: string;
    videoPrompt: string;
    characterIds: string[];
  }>,
): Promise<{ frame: FrameDto }> {
  return callApi<{ frame: FrameDto }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

export async function apiDeleteFrame(
  base: string,
  projectId: string,
  frameId: string,
): Promise<{ deleted: true }> {
  return callApi<{ deleted: true }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/frames/${encodeURIComponent(frameId)}`,
    { method: "DELETE" },
  );
}

export type StoryTaskListItem = PendingTaskDto & {
  model: string;
  createdAt: string;
  completedAt: string | null;
  ossUrl: string | null;
};

export async function apiListProjectTasks(
  base: string,
  projectId: string,
  limit = 50,
): Promise<StoryTaskListItem[]> {
  const data = await callApi<{ tasks: StoryTaskListItem[] }>(
    base,
    `/api/story/projects/${encodeURIComponent(projectId)}/tasks?limit=${limit}`,
    { method: "GET" },
  );
  return data.tasks;
}
