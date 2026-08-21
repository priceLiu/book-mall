/**
 * 画布门户发布：案例墙、精选、模板 · 用户提交与管理员审核。
 */
import type { CanvasPortalPublishKind, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  canvasProjectEditionFromGraph,
  canvasProjectHasCollaboration,
  type CanvasProjectEdition,
} from "@/lib/canvas/canvas-story-edition";
import { isRetiredLegacyPro2Canvas } from "@/lib/canvas/pro2-project-format";
import {
  CanvasProjectError,
  type CanvasProjectSummary,
  getCanvasProjectForUser,
} from "@/lib/canvas/canvas-project-service";
import {
  pickPersistableProjectThumbnailUrl,
  pickPersistableProjectThumbnailUrlPreferVideo,
  pickProjectThumbnailUrl,
  pickProjectThumbnailUrlPreferVideo,
} from "@/lib/canvas/pick-project-thumbnail";
import { projectListCoverSummaryFields } from "@/lib/canvas/canvas-project-list-cover";
import { collectSbv1ShowcaseMediaEntries } from "@/lib/canvas/sbv1-film-showcase";

export type PortalCaseProjectSummary = CanvasProjectSummary & {
  portalCaseBlurb: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

export type AdminPortalFilmProjectSummary = PortalCaseProjectSummary & {
  portalFilmCase: boolean;
  portalFilmCaseSort: number;
  mediaCount: number;
};

export type PortalSubmissionRow = {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  requestKind: CanvasPortalPublishKind;
  userNote: string;
  adminNote: string;
  reviewedAt: string | null;
  approvedKind: CanvasPortalPublishKind | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    thumbnailUrl: string;
    edition: CanvasProjectEdition;
  };
  user: { id: string; name: string | null; email: string | null };
};

const PUBLISH_KINDS: CanvasPortalPublishKind[] = [
  "CASE",
  "FEATURED",
  "TEMPLATE",
  "PUBLIC_TEMPLATE",
];

function portalCaseBlurbOf(p: {
  portalCaseBlurb: string;
  description: string;
}): string {
  const blurb = p.portalCaseBlurb?.trim();
  if (blurb) return blurb;
  return p.description?.trim() ?? "";
}

function toSummaryWithEdition(p: {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  canvas: unknown;
  createdAt: Date;
  updatedAt: Date;
}): CanvasProjectSummary {
  const canvas =
    p.canvas && typeof p.canvas === "object"
      ? (p.canvas as { meta?: unknown })
      : null;
  const edition = canvasProjectEditionFromGraph(p.canvas);
  const stored = p.thumbnailUrl?.trim() ?? "";
  const listCover = projectListCoverSummaryFields(p.canvas);
  const fromCanvas =
    listCover.thumbnailUrl ||
    pickPersistableProjectThumbnailUrlPreferVideo(p.canvas) ||
    pickProjectThumbnailUrlPreferVideo(p.canvas) ||
    pickProjectThumbnailUrl(p.canvas);
  const thumbnailUrl = fromCanvas || stored || "";
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    thumbnailUrl,
    edition,
    coverMediaKind: listCover.coverMediaKind,
    coverVideoUrl: listCover.coverVideoUrl,
    coverPosterUrl: listCover.coverPosterUrl,
    collaborationLocked: canvasProjectHasCollaboration(canvas?.meta),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function matchesPortalCaseEdition(
  canvas: unknown,
  edition?: CanvasProjectEdition,
): boolean {
  const resolved = canvasProjectEditionFromGraph(canvas);
  if (edition === "sbv1") return resolved === "sbv1";
  if (edition === "pro2") {
    return resolved === "pro2" && !isRetiredLegacyPro2Canvas(canvas);
  }
  return resolved === "pro2" && !isRetiredLegacyPro2Canvas(canvas);
}

/** 门户首页 · 案例墙项目（默认 pro2；传 edition=sbv1 为影视案例项目列表） */
export async function listPortalCaseCanvasProjects(opts?: {
  edition?: CanvasProjectEdition;
}): Promise<PortalCaseProjectSummary[]> {
  if (opts?.edition === "sbv1") {
    const rows = await prisma.canvasProject.findMany({
      where: { portalFilmCase: true, deletedAt: null },
      orderBy: [{ portalFilmCaseSort: "asc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return rows
      .filter((p) => matchesPortalCaseEdition(p.canvas, "sbv1"))
      .map((p) => ({
        ...toSummaryWithEdition(p),
        portalCaseBlurb: portalCaseBlurbOf(p),
        owner: p.user,
      }));
  }

  const rows = await prisma.canvasProject.findMany({
    where: { portalCase: true, deletedAt: null },
    orderBy: [{ portalCaseSort: "asc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return rows
    .filter((p) => matchesPortalCaseEdition(p.canvas, opts?.edition))
    .map((p) => ({
      ...toSummaryWithEdition(p),
      portalCaseBlurb: portalCaseBlurbOf(p),
      owner: p.user,
    }));
}

/** 管理员 · 分镜 1.0 影视作品列表（含未上架，用于首页上下架管理） */
export async function listAdminPortalFilmProjects(): Promise<
  AdminPortalFilmProjectSummary[]
> {
  const rows = await prisma.canvasProject.findMany({
    where: { deletedAt: null },
    orderBy: [{ portalFilmCaseSort: "asc" }, { updatedAt: "desc" }],
    take: 500,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return rows
    .filter((p) => canvasProjectEditionFromGraph(p.canvas) === "sbv1")
    .map((p) => ({
      ...toSummaryWithEdition(p),
      portalCaseBlurb: portalCaseBlurbOf(p),
      owner: p.user,
      portalFilmCase: p.portalFilmCase,
      portalFilmCaseSort: p.portalFilmCaseSort,
      mediaCount: collectSbv1ShowcaseMediaEntries(p.canvas).length,
    }));
}

/** 管理员 · 设置/取消门户案例（Pro2 案例墙 / sbv1 影视案例） */
export async function setCanvasProjectPortalCase(args: {
  projectId: string;
  case: boolean;
  sort?: number;
  blurb?: string;
}): Promise<PortalCaseProjectSummary> {
  const p = await prisma.canvasProject.findFirst({
    where: { id: args.projectId, deletedAt: null },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!p) throw new CanvasProjectError("NOT_FOUND", "project not found", 404);

  const edition = canvasProjectEditionFromGraph(p.canvas);
  const isFilmCase = edition === "sbv1";

  const updated = await prisma.canvasProject.update({
    where: { id: args.projectId },
    data: isFilmCase
      ? {
          portalFilmCase: args.case,
          ...(typeof args.sort === "number"
            ? { portalFilmCaseSort: args.sort }
            : {}),
          ...(typeof args.blurb === "string" ? { portalCaseBlurb: args.blurb } : {}),
        }
      : {
          portalCase: args.case,
          ...(typeof args.sort === "number" ? { portalCaseSort: args.sort } : {}),
          ...(typeof args.blurb === "string" ? { portalCaseBlurb: args.blurb } : {}),
        },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return {
    ...toSummaryWithEdition(updated),
    portalCaseBlurb: portalCaseBlurbOf(updated),
    owner: updated.user,
  };
}

function parsePublishKind(raw: unknown): CanvasPortalPublishKind | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (PUBLISH_KINDS.includes(s as CanvasPortalPublishKind)) {
    return s as CanvasPortalPublishKind;
  }
  return null;
}

/** 用户提交作品审核 · 模板类即时生效；精选/案例须审核（管理员全部即时） */
export async function submitCanvasProjectPortalReview(args: {
  userId: string;
  projectId: string;
  requestKind: CanvasPortalPublishKind;
  userNote?: string;
  isAdmin?: boolean;
}): Promise<{ appliedImmediately: boolean; submission?: PortalSubmissionRow }> {
  await getCanvasProjectForUser(args.userId, args.projectId);

  const kind = args.requestKind;
  if (!PUBLISH_KINDS.includes(kind)) {
    throw new CanvasProjectError("INVALID_INPUT", "invalid publish kind", 400);
  }

  const immediate =
    args.isAdmin === true ||
    kind === "PUBLIC_TEMPLATE" ||
    kind === "TEMPLATE";

  if (immediate) {
    await applyPortalPublication(args.projectId, kind);
    return { appliedImmediately: true };
  }

  const pending = await prisma.canvasPortalSubmission.findFirst({
    where: { projectId: args.projectId, status: "PENDING" },
  });
  if (pending) {
    throw new CanvasProjectError(
      "CONFLICT",
      "该项目已有待审核提交，请等待管理员处理",
      409,
    );
  }

  const row = await prisma.canvasPortalSubmission.create({
    data: {
      projectId: args.projectId,
      userId: args.userId,
      requestKind: kind,
      userNote: args.userNote?.trim() ?? "",
    },
    include: {
      project: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return { appliedImmediately: false, submission: mapSubmissionRow(row) };
}

export async function listCanvasPortalSubmissions(args: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  limit?: number;
}): Promise<PortalSubmissionRow[]> {
  const rows = await prisma.canvasPortalSubmission.findMany({
    where: args.status ? { status: args.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(200, args.limit ?? 50),
    include: {
      project: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return rows.map(mapSubmissionRow);
}

async function createTemplateFromProject(
  project: {
    id: string;
    userId: string;
    name: string;
    description: string;
    thumbnailUrl: string;
    canvas: unknown;
  },
  visibility: "private" | "public",
): Promise<void> {
  const edition = canvasProjectEditionFromGraph(project.canvas);
  const thumbnail =
    project.thumbnailUrl?.trim() ||
    pickPersistableProjectThumbnailUrl(project.canvas) ||
    "";
  await prisma.canvasTemplate.create({
    data: {
      ownerUserId: project.userId,
      category: visibility === "public" ? "community" : "user",
      name: project.name.trim() || "工作流模板",
      thumbnail,
      description: project.description?.trim() ?? "",
      edition,
      sourceLabel: "门户审核",
      visibility,
      canvas: project.canvas as Prisma.InputJsonValue,
      builtin: false,
    },
  });
}

async function applyPortalPublication(
  projectId: string,
  kind: CanvasPortalPublishKind,
): Promise<void> {
  const project = await prisma.canvasProject.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!project) throw new CanvasProjectError("NOT_FOUND", "project not found", 404);

  switch (kind) {
    case "CASE": {
      const edition = canvasProjectEditionFromGraph(project.canvas);
      if (edition === "sbv1") {
        await prisma.canvasProject.update({
          where: { id: projectId },
          data: { portalFilmCase: true },
        });
      } else {
        await prisma.canvasProject.update({
          where: { id: projectId },
          data: { portalCase: true },
        });
      }
      break;
    }
    case "FEATURED":
      await prisma.canvasProject.update({
        where: { id: projectId },
        data: { portalFeatured: true },
      });
      break;
    case "TEMPLATE":
      await createTemplateFromProject(project, "private");
      break;
    case "PUBLIC_TEMPLATE":
      await createTemplateFromProject(project, "public");
      break;
    default:
      throw new CanvasProjectError("INVALID_INPUT", "invalid publish kind", 400);
  }
}

/** 管理员审核 */
export async function reviewCanvasPortalSubmission(args: {
  submissionId: string;
  reviewerUserId: string;
  approve: boolean;
  approvedKind?: CanvasPortalPublishKind;
  adminNote?: string;
}): Promise<PortalSubmissionRow> {
  const sub = await prisma.canvasPortalSubmission.findUnique({
    where: { id: args.submissionId },
    include: { project: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!sub) throw new CanvasProjectError("NOT_FOUND", "submission not found", 404);
  if (sub.status !== "PENDING") {
    throw new CanvasProjectError("CONFLICT", "该提交已处理", 409);
  }

  if (!args.approve) {
    const updated = await prisma.canvasPortalSubmission.update({
      where: { id: args.submissionId },
      data: {
        status: "REJECTED",
        reviewedByUserId: args.reviewerUserId,
        reviewedAt: new Date(),
        adminNote: args.adminNote?.trim() ?? "",
      },
      include: {
        project: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return mapSubmissionRow(updated);
  }

  const kind = args.approvedKind ?? sub.requestKind;
  if (!PUBLISH_KINDS.includes(kind)) {
    throw new CanvasProjectError("INVALID_INPUT", "approvedKind required", 400);
  }

  await applyPortalPublication(sub.projectId, kind);

  const updated = await prisma.canvasPortalSubmission.update({
    where: { id: args.submissionId },
    data: {
      status: "APPROVED",
      approvedKind: kind,
      reviewedByUserId: args.reviewerUserId,
      reviewedAt: new Date(),
      adminNote: args.adminNote?.trim() ?? "",
    },
    include: {
      project: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return mapSubmissionRow(updated);
}

function mapSubmissionRow(
  row: {
    id: string;
    projectId: string;
    userId: string;
    status: string;
    requestKind: CanvasPortalPublishKind;
    userNote: string;
    adminNote: string;
    reviewedAt: Date | null;
    approvedKind: CanvasPortalPublishKind | null;
    createdAt: Date;
    project: {
      id: string;
      name: string;
      description: string;
      thumbnailUrl: string;
      canvas: unknown;
    };
    user: { id: string; name: string | null; email: string | null };
  },
): PortalSubmissionRow {
  const summary = toSummaryWithEdition({
    ...row.project,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  });
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    status: row.status,
    requestKind: row.requestKind,
    userNote: row.userNote,
    adminNote: row.adminNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    approvedKind: row.approvedKind,
    createdAt: row.createdAt.toISOString(),
    project: {
      id: summary.id,
      name: summary.name,
      thumbnailUrl: summary.thumbnailUrl,
      edition: summary.edition,
    },
    user: row.user,
  };
}

export type AdminPortalProjectPreview = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  edition: CanvasProjectEdition;
  portalFeatured: boolean;
  portalCase: boolean;
  portalFilmCase: boolean;
  portalFeaturedBlurb: string;
  portalCaseBlurb: string;
  canvas: unknown;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

/** 管理员 · 门户项目预览（含画布结构，用于审核） */
export async function getAdminPortalProjectPreview(
  projectId: string,
): Promise<AdminPortalProjectPreview> {
  const p = await prisma.canvasProject.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!p) throw new CanvasProjectError("NOT_FOUND", "project not found", 404);
  const summary = toSummaryWithEdition(p);
  return {
    id: summary.id,
    name: summary.name,
    description: summary.description,
    thumbnailUrl: summary.thumbnailUrl,
    edition: summary.edition,
    portalFeatured: p.portalFeatured,
    portalCase: p.portalCase,
    portalFilmCase: p.portalFilmCase,
    portalFeaturedBlurb:
      p.portalFeaturedBlurb?.trim() || p.description?.trim() || "",
    portalCaseBlurb: portalCaseBlurbOf(p),
    canvas: p.canvas,
    owner: p.user,
  };
}

export { parsePublishKind };
