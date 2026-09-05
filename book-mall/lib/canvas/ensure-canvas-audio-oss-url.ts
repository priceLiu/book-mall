import {
  patchCanvasJsonNodeMedia,
  patchCanvasProjectNodeMediaFromTask,
} from "@/lib/canvas/canvas-media-patch";
import {
  persistCanvasBufferToOss,
  persistCanvasKieResultToOss,
} from "@/lib/canvas/canvas-oss";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function parseAudioDataUrl(dataUrl: string): {
  buf: Buffer;
  contentType: string;
  ext: string;
} {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("无效的音频 data URL");
  const contentType = m[1] || "audio/mpeg";
  const buf = Buffer.from(m[2], "base64");
  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("ogg")
      ? "ogg"
      : "mp3";
  return { buf, contentType, ext };
}

function pickHttpsUrl(...candidates: (string | null | undefined)[]): string {
  for (const raw of candidates) {
    const url = String(raw ?? "").trim();
    if (/^https:\/\//i.test(url)) return url;
  }
  return "";
}

function pickDataUrlFromNodeData(
  d: {
    ossUrl?: string;
    blobUrl?: string;
    runtime?: {
      ossUrl?: string;
      ephemeralUrl?: string;
    };
  } | undefined,
): string {
  for (const raw of [
    d?.runtime?.ephemeralUrl,
    d?.blobUrl,
    d?.ossUrl,
    d?.runtime?.ossUrl,
  ]) {
    const url = String(raw ?? "").trim();
    if (url.startsWith("data:")) return url;
  }
  return "";
}

type CanvasNodeRow = {
  id: string;
  type?: string;
  data?: {
    ossUrl?: string;
    blobUrl?: string;
    runtime?: {
      taskId?: string;
      ossUrl?: string;
      ephemeralUrl?: string;
    };
  };
};

const AUDIO_TASK_SELECT = {
  id: true,
  projectId: true,
  nodeId: true,
  ossUrl: true,
  ephemeralUrl: true,
  completedAt: true,
  resultPayload: true,
} as const;

type AudioTaskRow = Prisma.CanvasGenerationTaskGetPayload<{
  select: typeof AUDIO_TASK_SELECT;
}>;

async function resolveSucceededAudioTask(args: {
  userId: string;
  projectId: string;
  nodeId: string;
  preferredTaskId?: string;
}): Promise<AudioTaskRow | null> {
  const baseWhere = {
    projectId: args.projectId,
    nodeId: args.nodeId,
    deletedAt: null,
    project: { userId: args.userId, deletedAt: null },
    status: "SUCCEEDED" as const,
  };

  const preferredId = args.preferredTaskId?.trim();
  if (preferredId) {
    const byId = await prisma.canvasGenerationTask.findFirst({
      where: { ...baseWhere, id: preferredId },
      select: AUDIO_TASK_SELECT,
    });
    if (byId) return byId;
  }

  return prisma.canvasGenerationTask.findFirst({
    where: baseWhere,
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    select: AUDIO_TASK_SELECT,
  });
}

async function uploadEphemeralAudioToOss(args: {
  ephemeral: string;
  projectId: string;
  userId: string;
}): Promise<string | undefined> {
  const ephemeral = args.ephemeral.trim();
  if (!ephemeral) return undefined;

  if (ephemeral.startsWith("data:")) {
    const { buf, contentType, ext } = parseAudioDataUrl(ephemeral);
    return persistCanvasBufferToOss({
      buf,
      contentType,
      kind: "node-audio",
      projectId: args.projectId,
      userId: args.userId,
      ext,
    });
  }

  if (/^https:\/\//i.test(ephemeral)) {
    return persistCanvasKieResultToOss({
      ephemeralUrl: ephemeral,
      kind: "node-audio",
      projectId: args.projectId,
      userId: args.userId,
    });
  }

  return undefined;
}

async function persistAudioOssToCanvasNode(args: {
  projectId: string;
  nodeId: string;
  ossUrl: string;
  task?: AudioTaskRow;
}): Promise<void> {
  if (args.task) {
    await patchCanvasProjectNodeMediaFromTask(
      { ...args.task, ossUrl: args.ossUrl },
      { nodeType: "story-pro2-audio" },
    ).catch(() => undefined);
    return;
  }

  const project = await prisma.canvasProject.findUnique({
    where: { id: args.projectId },
    select: { canvas: true },
  });
  if (!project?.canvas) return;

  const next = patchCanvasJsonNodeMedia(
    project.canvas,
    args.nodeId,
    "story-pro2-audio",
    args.ossUrl,
    {
      status: "done",
      taskId: `audio-oss:${args.nodeId}`,
      ossUrl: args.ossUrl,
    },
  );
  await prisma.canvasProject
    .update({
      where: { id: args.projectId },
      data: { canvas: next as Prisma.InputJsonValue },
    })
    .catch(() => undefined);
}

async function materializeAudioTaskOssUrl(args: {
  task: AudioTaskRow;
  userId: string;
}): Promise<string | undefined> {
  const fromTask = pickHttpsUrl(args.task.ossUrl, args.task.ephemeralUrl);
  if (fromTask) {
    await patchCanvasProjectNodeMediaFromTask(args.task, {
      nodeType: "story-pro2-audio",
    }).catch(() => undefined);
    return fromTask;
  }

  const ephemeral = args.task.ephemeralUrl?.trim() ?? "";
  const ossUrl = await uploadEphemeralAudioToOss({
    ephemeral,
    projectId: args.task.projectId,
    userId: args.userId,
  });
  if (!ossUrl) return undefined;

  await prisma.canvasGenerationTask.updateMany({
    where: { id: args.task.id, status: "SUCCEEDED" },
    data: { ossUrl },
  });

  const updated = await prisma.canvasGenerationTask.findUnique({
    where: { id: args.task.id },
    select: AUDIO_TASK_SELECT,
  });
  const patched = updated ?? { ...args.task, ossUrl };
  await patchCanvasProjectNodeMediaFromTask(patched, {
    nodeType: "story-pro2-audio",
  }).catch(() => undefined);
  return ossUrl;
}

/** 自动成片提交前：将 TTS 本地预览（data:）同步落 OSS，返回 HTTPS 可混音 URL */
export async function ensureCanvasAudioNodeHttpsUrl(args: {
  userId: string;
  projectId: string;
  nodeId: string;
  canvasNodes: CanvasNodeRow[];
}): Promise<string | undefined> {
  const node = args.canvasNodes.find((n) => n.id === args.nodeId);
  if (!node || node.type !== "story-pro2-audio") return undefined;

  const d = node.data ?? {};
  const fromNode = pickHttpsUrl(d.runtime?.ossUrl, d.ossUrl, d.runtime?.ephemeralUrl);
  if (fromNode) return fromNode;

  const nodeDataUrl = pickDataUrlFromNodeData(d);
  if (nodeDataUrl) {
    const ossUrl = await uploadEphemeralAudioToOss({
      ephemeral: nodeDataUrl,
      projectId: args.projectId,
      userId: args.userId,
    });
    if (ossUrl) {
      await persistAudioOssToCanvasNode({
        projectId: args.projectId,
        nodeId: args.nodeId,
        ossUrl,
      });
      return ossUrl;
    }
  }

  const task = await resolveSucceededAudioTask({
    userId: args.userId,
    projectId: args.projectId,
    nodeId: args.nodeId,
    preferredTaskId: d.runtime?.taskId,
  });
  if (!task) return undefined;

  return materializeAudioTaskOssUrl({ task, userId: args.userId });
}

export { pickDataUrlFromNodeData, pickHttpsUrl };
