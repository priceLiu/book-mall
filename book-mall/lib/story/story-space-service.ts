import type {
  Prisma,
  StoryEngineModel,
  StorySpace,
  StorySpaceModelSelection,
  User,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  STORY_DEFAULT_COVER,
  STORY_DEFAULT_PRIMARY_MODEL_KEYS,
  STORY_DEMO_VIDEO_URL,
  slugifyStorySpace,
} from "@/lib/story/story-constants";

export type StorySpaceDto = ReturnType<typeof serializeStorySpace>;

export type StoryEngineModelDto = {
  id: string;
  modelKey: string;
  displayName: string;
  vendor: string;
  role: string;
  description: string | null;
  sortOrder: number;
  defaultParams: unknown;
};

export type StoryModelSelectionDto = {
  engineModelId: string;
  modelKey: string;
  displayName: string;
  vendor: string;
  role: string;
  enabled: boolean;
  isPrimary: boolean;
  params: unknown;
};

type SpaceWithSelections = StorySpace & {
  modelSelections: (StorySpaceModelSelection & { engineModel: StoryEngineModel })[];
};

function serializeStorySpace(
  space: SpaceWithSelections,
  extras?: { publishedProductSlug?: string | null; isOwner?: boolean },
) {
  return {
    id: space.id,
    slug: space.slug,
    templateKey: space.templateKey,
    title: space.title,
    tagline: space.tagline,
    subtitle: space.subtitle,
    ownerDisplayName: space.ownerDisplayName,
    featuredWork: {
      title: space.featuredWorkTitle,
      description: space.featuredWorkDescription,
      videoSrc: space.featuredVideoUrl,
      poster: space.featuredVideoPosterUrl,
    },
    publishStatus: space.publishStatus,
    publishedAt: space.publishedAt?.toISOString() ?? null,
    publishedProductSlug: extras?.publishedProductSlug ?? null,
    isOwner: extras?.isOwner ?? false,
    modelSelections: space.modelSelections.map(serializeSelection),
  };
}

function serializeSelection(
  row: StorySpaceModelSelection & { engineModel: StoryEngineModel },
): StoryModelSelectionDto {
  return {
    engineModelId: row.engineModelId,
    modelKey: row.engineModel.modelKey,
    displayName: row.engineModel.displayName,
    vendor: row.engineModel.vendor,
    role: row.engineModel.role,
    enabled: row.enabled,
    isPrimary: row.isPrimary,
    params: row.params ?? row.engineModel.defaultParams,
  };
}

export function serializeEngineModel(m: StoryEngineModel): StoryEngineModelDto {
  return {
    id: m.id,
    modelKey: m.modelKey,
    displayName: m.displayName,
    vendor: m.vendor,
    role: m.role,
    description: m.description,
    sortOrder: m.sortOrder,
    defaultParams: m.defaultParams,
  };
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 0;
  while (await prisma.storySpace.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

async function initDefaultSelections(storySpaceId: string) {
  const models = await prisma.storyEngineModel.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
  });
  const primaryKeys = new Set<string>(Object.values(STORY_DEFAULT_PRIMARY_MODEL_KEYS));
  await prisma.storySpaceModelSelection.createMany({
    data: models.map((m) => ({
      storySpaceId,
      engineModelId: m.id,
      enabled: true,
      isPrimary: primaryKeys.has(m.modelKey),
      params: m.defaultParams ?? undefined,
    })),
    skipDuplicates: true,
  });
}

export async function ensureStorySpaceForUser(user: Pick<User, "id" | "name" | "email">) {
  const existing = await prisma.storySpace.findUnique({
    where: { userId: user.id },
    include: {
      modelSelections: { include: { engineModel: true } },
      publishedProduct: { select: { slug: true } },
    },
  });
  if (existing) {
    return serializeStorySpace(existing, {
      publishedProductSlug: existing.publishedProduct?.slug ?? null,
      isOwner: true,
    });
  }

  const baseSlug = await uniqueSlug(slugifyStorySpace(user.id, user.name, user.email));
  const created = await prisma.storySpace.create({
    data: {
      userId: user.id,
      slug: baseSlug,
      title: "漫剧个人空间",
      tagline: "用 AI 速度，讲好你的漫剧故事",
      subtitle:
        "一人即剧场的创作空间：首页可发布到 book-mall，创作室、影像室与模型配置逐步接入。",
      ownerDisplayName: user.name ?? user.email?.split("@")[0] ?? "创作者",
      featuredWorkTitle: "《星尘旅人》预告",
      featuredWorkDescription: "科幻漫剧片段 · 可直接播放",
      featuredVideoUrl: STORY_DEMO_VIDEO_URL,
    },
    include: {
      modelSelections: { include: { engineModel: true } },
      publishedProduct: { select: { slug: true } },
    },
  });

  await initDefaultSelections(created.id);

  const withSelections = await prisma.storySpace.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      modelSelections: { include: { engineModel: true } },
      publishedProduct: { select: { slug: true } },
    },
  });

  return serializeStorySpace(withSelections, { isOwner: true });
}

export async function getStorySpaceBySlug(slug: string, viewerUserId?: string | null) {
  const space = await prisma.storySpace.findUnique({
    where: { slug },
    include: {
      modelSelections: { include: { engineModel: true } },
      publishedProduct: { select: { slug: true } },
    },
  });
  if (!space) return null;
  const isOwner = !!viewerUserId && space.userId === viewerUserId;
  if (!isOwner && space.publishStatus !== "PUBLISHED") return null;
  return serializeStorySpace(space, {
    publishedProductSlug: space.publishedProduct?.slug ?? null,
    isOwner,
  });
}

export async function updateStorySpaceForUser(
  userId: string,
  patch: Partial<{
    title: string;
    tagline: string;
    subtitle: string;
    ownerDisplayName: string;
    featuredWorkTitle: string;
    featuredWorkDescription: string;
    featuredVideoUrl: string;
    featuredVideoPosterUrl: string;
    templateKey: "CLASSIC_V1";
  }>,
) {
  const space = await prisma.storySpace.findUnique({ where: { userId } });
  if (!space) throw new Error("story_space_not_found");

  const data: Prisma.StorySpaceUpdateInput = {};
  if (patch.title != null) data.title = patch.title;
  if (patch.tagline != null) data.tagline = patch.tagline;
  if (patch.subtitle != null) data.subtitle = patch.subtitle;
  if (patch.ownerDisplayName != null) data.ownerDisplayName = patch.ownerDisplayName;
  if (patch.featuredWorkTitle != null) data.featuredWorkTitle = patch.featuredWorkTitle;
  if (patch.featuredWorkDescription != null) data.featuredWorkDescription = patch.featuredWorkDescription;
  if (patch.featuredVideoUrl != null) data.featuredVideoUrl = patch.featuredVideoUrl;
  if (patch.featuredVideoPosterUrl != null) data.featuredVideoPosterUrl = patch.featuredVideoPosterUrl;
  if (patch.templateKey != null) data.templateKey = patch.templateKey;

  const updated = await prisma.storySpace.update({
    where: { userId },
    data,
    include: {
      modelSelections: { include: { engineModel: true } },
      publishedProduct: { select: { slug: true } },
    },
  });
  return serializeStorySpace(updated, {
    publishedProductSlug: updated.publishedProduct?.slug ?? null,
    isOwner: true,
  });
}

export async function listStoryEngineModels() {
  const rows = await prisma.storyEngineModel.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
  });
  return rows.map(serializeEngineModel);
}

export async function updateStoryModelConfig(
  userId: string,
  updates: { engineModelId: string; enabled?: boolean; isPrimary?: boolean; params?: unknown }[],
) {
  const space = await prisma.storySpace.findUnique({ where: { userId } });
  if (!space) throw new Error("story_space_not_found");

  for (const u of updates) {
    const row = await prisma.storySpaceModelSelection.findUnique({
      where: {
        storySpaceId_engineModelId: {
          storySpaceId: space.id,
          engineModelId: u.engineModelId,
        },
      },
      include: { engineModel: true },
    });
    if (!row) continue;

    if (u.isPrimary === true) {
      await prisma.storySpaceModelSelection.updateMany({
        where: {
          storySpaceId: space.id,
          engineModel: { role: row.engineModel.role },
        },
        data: { isPrimary: false },
      });
    }

    await prisma.storySpaceModelSelection.update({
      where: { id: row.id },
      data: {
        enabled: u.enabled ?? row.enabled,
        isPrimary: u.isPrimary ?? row.isPrimary,
        params: u.params !== undefined ? (u.params as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  const refreshed = await prisma.storySpace.findUniqueOrThrow({
    where: { userId },
    include: {
      modelSelections: { include: { engineModel: true } },
      publishedProduct: { select: { slug: true } },
    },
  });
  return serializeStorySpace(refreshed, {
    publishedProductSlug: refreshed.publishedProduct?.slug ?? null,
    isOwner: true,
  });
}

export async function publishStorySpaceToBookMall(userId: string) {
  const space = await prisma.storySpace.findUnique({
    where: { userId },
    include: { publishedProduct: true },
  });
  if (!space) throw new Error("story_space_not_found");

  const productSlug = `story-${space.slug}`;
  const summary = space.tagline;
  const description = `${space.subtitle}\n\n代表作：${space.featuredWorkTitle}`;

  let productId = space.publishedProductId;
  if (productId && space.publishedProduct) {
    await prisma.product.update({
      where: { id: productId },
      data: {
        title: space.title,
        summary,
        description,
        coverImageUrl: space.featuredVideoPosterUrl ?? STORY_DEFAULT_COVER,
        status: "PUBLISHED",
        catalogUnavailable: false,
      },
    });
  } else {
    const created = await prisma.product.create({
      data: {
        title: space.title,
        slug: productSlug,
        summary,
        description,
        kind: "TOOL",
        tier: "BASIC",
        coverImageUrl: space.featuredVideoPosterUrl ?? STORY_DEFAULT_COVER,
        status: "PUBLISHED",
        toolNavKey: "story-theater",
        featuredHome: false,
      },
    });
    productId = created.id;
  }

  const updated = await prisma.storySpace.update({
    where: { userId },
    data: {
      publishStatus: "PUBLISHED",
      publishedAt: new Date(),
      publishedProductId: productId,
    },
    include: {
      modelSelections: { include: { engineModel: true } },
      publishedProduct: { select: { slug: true } },
    },
  });

  return serializeStorySpace(updated, {
    publishedProductSlug: updated.publishedProduct?.slug ?? productSlug,
    isOwner: true,
  });
}

export async function getStorySpaceForProductSlug(productSlug: string) {
  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    include: {
      storySpaceAsPublished: true,
    },
  });
  if (!product?.storySpaceAsPublished) return null;
  const s = product.storySpaceAsPublished;
  return {
    featuredVideoUrl: s.featuredVideoUrl,
    featuredVideoPosterUrl: s.featuredVideoPosterUrl,
    featuredWorkTitle: s.featuredWorkTitle,
    storySpaceSlug: s.slug,
  };
}
