import { prisma } from "@/lib/prisma";

export class StoryProStyleProfileError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID_INPUT" | "LOCKED",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "StoryProStyleProfileError";
  }
}

export type StoryProStyleProfileRecord = {
  id: string;
  projectId: string | null;
  profileKey: string;
  displayName: string;
  locked: boolean;
  version: number;
  mainStyle: string | null;
  colorTone: string | null;
  renderQuality: string | null;
  anchorZh: string | null;
  anchorEn: string | null;
  negativePrompt: string | null;
  refImageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

function parseRefUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
}

function toRecord(row: {
  id: string;
  projectId: string | null;
  profileKey: string;
  displayName: string;
  locked: boolean;
  version: number;
  mainStyle: string | null;
  colorTone: string | null;
  renderQuality: string | null;
  anchorZh: string | null;
  anchorEn: string | null;
  negativePrompt: string | null;
  refImageUrls: unknown;
  createdAt: Date;
  updatedAt: Date;
}): StoryProStyleProfileRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    profileKey: row.profileKey,
    displayName: row.displayName,
    locked: row.locked,
    version: row.version,
    mainStyle: row.mainStyle,
    colorTone: row.colorTone,
    renderQuality: row.renderQuality,
    anchorZh: row.anchorZh,
    anchorEn: row.anchorEn,
    negativePrompt: row.negativePrompt,
    refImageUrls: parseRefUrls(row.refImageUrls),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listStoryProStyleProfiles(
  userId: string,
  opts?: { projectId?: string | null },
): Promise<StoryProStyleProfileRecord[]> {
  const projectId = opts?.projectId?.trim() || null;
  const rows = await prisma.storyProStyleProfile.findMany({
    where: {
      userId,
      OR: [{ projectId }, { projectId: null }],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(toRecord);
}

export async function upsertStoryProStyleProfile(
  userId: string,
  args: {
    projectId?: string | null;
    profileKey?: string;
    displayName: string;
    mainStyle?: string | null;
    colorTone?: string | null;
    renderQuality?: string | null;
    anchorZh?: string | null;
    anchorEn?: string | null;
    negativePrompt?: string | null;
    refImageUrls?: string[];
  },
): Promise<StoryProStyleProfileRecord> {
  const displayName = args.displayName.trim().slice(0, 120);
  const projectId = args.projectId?.trim() || null;
  const profileKey = (args.profileKey ?? "default").trim().slice(0, 40) || "default";
  if (!displayName) {
    throw new StoryProStyleProfileError("INVALID_INPUT", "displayName required");
  }

  const refImageUrls = (args.refImageUrls ?? []).filter((u) =>
    /^https?:\/\//.test(u),
  );

  const existing = await prisma.storyProStyleProfile.findFirst({
    where: { userId, projectId, profileKey },
  });

  if (existing?.locked) {
    throw new StoryProStyleProfileError(
      "LOCKED",
      "全局风格已锁定，无法修改",
      403,
    );
  }

  const data = {
    displayName,
    mainStyle: args.mainStyle?.trim() || null,
    colorTone: args.colorTone?.trim() || null,
    renderQuality: args.renderQuality?.trim() || null,
    anchorZh: args.anchorZh?.trim() || null,
    anchorEn: args.anchorEn?.trim() || null,
    negativePrompt: args.negativePrompt?.trim() || null,
    refImageUrls,
    version: existing ? { increment: 1 } : undefined,
  };

  const row = existing
    ? await prisma.storyProStyleProfile.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.storyProStyleProfile.create({
        data: {
          userId,
          projectId,
          profileKey,
          displayName,
          mainStyle: data.mainStyle,
          colorTone: data.colorTone,
          renderQuality: data.renderQuality,
          anchorZh: data.anchorZh,
          anchorEn: data.anchorEn,
          negativePrompt: data.negativePrompt,
          refImageUrls,
        },
      });

  return toRecord(row);
}

export async function setStoryProStyleProfileLocked(
  userId: string,
  profileId: string,
  locked: boolean,
): Promise<StoryProStyleProfileRecord> {
  const row = await prisma.storyProStyleProfile.findFirst({
    where: { id: profileId, userId },
  });
  if (!row) {
    throw new StoryProStyleProfileError("NOT_FOUND", "风格配置不存在", 404);
  }
  const updated = await prisma.storyProStyleProfile.update({
    where: { id: profileId },
    data: { locked },
  });
  return toRecord(updated);
}
