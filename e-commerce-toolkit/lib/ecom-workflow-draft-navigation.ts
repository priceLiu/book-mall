"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { createHandCraftProject } from "@/lib/ecom-hand-craft-api";
import { createMediaDecomposeProject } from "@/lib/ecom-media-decompose-api";
import {
  createProductDesignProject,
  type EcomProjectModule,
} from "@/lib/ecom-product-design-api";
import { createSeedVideoProject } from "@/lib/ecom-seed-video-api";
import { createStoryboardProject } from "@/lib/ecom-storyboard-api";
import type { EcomWorkflowDraftKind } from "@/lib/ecom-workflow-drafts-api";

export const STORYBOARD_DRAFT_STORAGE_KEY = "ecom-storyboard-active-project";
export const SEED_VIDEO_DRAFT_STORAGE_KEY = "ecom-seed-video-active-project";
export const MEDIA_DECOMPOSE_DRAFT_STORAGE_KEY = "ecom-media-decompose-active-project";
export const HAND_CRAFT_DRAFT_STORAGE_KEY = "ecom-hand-craft-active-project";

export function productDesignDraftStorageKey(module: EcomProjectModule): string {
  return `ecom-product-design-active-project:${module === "detail-page" ? "detail-page" : "main-image"}`;
}

export function workflowDraftStudioPath(kind: EcomWorkflowDraftKind): string {
  switch (kind) {
    case "storyboard":
      return "/ecom/storyboard/micro-drama";
    case "product-design-main":
      return "/ecom/product-creation";
    case "product-design-detail":
      return "/ecom/detail-page-creation";
    case "hand-craft":
      return "/ecom/hand-craft";
    case "seed-video":
      return "/ecom/seed-video";
    case "media-decompose":
      return "/ecom/media-decompose";
  }
}

export function workflowDraftStorageKey(kind: EcomWorkflowDraftKind): string {
  switch (kind) {
    case "storyboard":
      return STORYBOARD_DRAFT_STORAGE_KEY;
    case "product-design-main":
      return productDesignDraftStorageKey("main-image");
    case "product-design-detail":
      return productDesignDraftStorageKey("detail-page");
    case "hand-craft":
      return HAND_CRAFT_DRAFT_STORAGE_KEY;
    case "seed-video":
      return SEED_VIDEO_DRAFT_STORAGE_KEY;
    case "media-decompose":
      return MEDIA_DECOMPOSE_DRAFT_STORAGE_KEY;
  }
}

export function openWorkflowDraft(
  router: AppRouterInstance,
  kind: EcomWorkflowDraftKind,
  projectId: string,
): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(workflowDraftStorageKey(kind), projectId);
  }
  router.push(workflowDraftStudioPath(kind));
}

export async function createWorkflowDraft(
  kind: EcomWorkflowDraftKind,
): Promise<{ projectId: string }> {
  switch (kind) {
    case "storyboard": {
      const project = await createStoryboardProject({
        title: "电商专业版",
        meta: {
          workflow: {
            proMode: true,
            proPhase: "product_ref",
            dimensionStep: 0,
          },
        },
      });
      return { projectId: project.id };
    }
    case "product-design-main": {
      const project = await createProductDesignProject({ module: "main-image" });
      return { projectId: project.id };
    }
    case "product-design-detail": {
      const project = await createProductDesignProject({ module: "detail-page" });
      return { projectId: project.id };
    }
    case "hand-craft": {
      const project = await createHandCraftProject();
      return { projectId: project.id };
    }
    case "seed-video": {
      const project = await createSeedVideoProject();
      return { projectId: project.id };
    }
    case "media-decompose": {
      const project = await createMediaDecomposeProject();
      return { projectId: project.id };
    }
  }
}

export async function startNewWorkflowDraft(
  router: AppRouterInstance,
  kind: EcomWorkflowDraftKind,
): Promise<void> {
  const { projectId } = await createWorkflowDraft(kind);
  openWorkflowDraft(router, kind, projectId);
}

export async function deleteWorkflowDraft(
  kind: EcomWorkflowDraftKind,
  projectId: string,
): Promise<void> {
  switch (kind) {
    case "storyboard":
      await import("@/lib/ecom-storyboard-api").then((m) =>
        m.deleteStoryboardProject(projectId),
      );
      return;
    case "product-design-main":
    case "product-design-detail":
      await import("@/lib/ecom-product-design-api").then((m) =>
        m.deleteProductDesignProject(projectId),
      );
      return;
    case "hand-craft":
      await import("@/lib/ecom-hand-craft-api").then((m) =>
        m.deleteHandCraftProject(projectId),
      );
      return;
    case "seed-video":
      await import("@/lib/ecom-seed-video-api").then((m) =>
        m.deleteSeedVideoProject(projectId),
      );
      return;
    case "media-decompose":
      await import("@/lib/ecom-media-decompose-api").then((m) =>
        m.deleteMediaDecomposeProject(projectId),
      );
      return;
  }
}

export function formatWorkflowDraftUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
