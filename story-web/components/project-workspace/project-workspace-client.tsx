"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { DestructiveConfirmModal } from "@/components/common/destructive-confirm-modal";
import {
  apiDeleteProject,
  apiGetProject,
  BookMallApiError,
} from "@/lib/projects/api";
import type { ComicProject, ProjectStep } from "@/lib/projects/types";
import { projectHasInflightTasks, countInflightTasks } from "@/lib/projects/task-status";
import { cn } from "@/lib/utils";
import { StorySetupTab } from "./story-setup-tab";
import { StoryboardTab } from "./storyboard-tab";

const STEPS: { id: ProjectStep; label: string }[] = [
  { id: "story", label: "故事设定" },
  { id: "storyboard", label: "分镜设定" },
];

type ProjectWorkspaceClientProps = {
  projectId: string;
};

export function ProjectWorkspaceClient({
  projectId,
}: ProjectWorkspaceClientProps) {
  const router = useRouter();
  const base = useBookMallBaseUrl();
  const [project, setProject] = useState<ComicProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ProjectStep>("story");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = useCallback(async () => {
    if (!base) return;
    try {
      const dto = await apiGetProject(base, projectId);
      setProject({
        ...dto,
        coverTaskStatus: dto.coverTaskStatus,
        coverTaskFailCode: dto.coverTaskFailCode,
        coverTaskFailMessage: dto.coverTaskFailMessage,
        characters: dto.characters,
        storyboardFrames: dto.frames,
        pendingTasks: dto.pendingTasks,
      });
      setError(null);
    } catch (e) {
      if (e instanceof BookMallApiError && e.code === "NOT_FOUND") {
        setError("项目不存在或已被删除。");
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, [base, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 自动轮询：存在进行中任务时每 5s 刷新（pendingTasks + *TaskStatus 双通道）
  useEffect(() => {
    if (!project) return;
    if (!projectHasInflightTasks(project)) return;
    const t = setInterval(() => {
      void reload();
    }, 5000);
    return () => clearInterval(t);
  }, [project, reload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--story-bg)] text-[var(--story-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        加载项目…
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--story-bg)] text-[var(--story-muted)]">
        <p>{error ?? "项目不存在或已被删除。"}</p>
        <Link
          href="/projects"
          className="rounded-md border border-white/20 px-4 py-1.5 text-sm text-white hover:bg-white/5"
        >
          返回创作室
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--story-bg)]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--story-bg)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/projects"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/5"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">返回创作室</span>
            </Link>
            <h1 className="truncate text-sm font-medium text-white sm:text-base">
              {project.name}
            </h1>
            {projectHasInflightTasks(project) ? (
              <span className="hidden rounded-md bg-emerald-500/85 px-2 py-0.5 text-[10px] text-black sm:inline">
                {countInflightTasks(project)} 个任务进行中
              </span>
            ) : null}
          </div>

          <nav
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1"
            aria-label="创作步骤"
          >
            {STEPS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setStep(id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition",
                  step === id
                    ? "bg-white text-black"
                    : "text-[var(--story-muted)] hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="hidden flex-1 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/80 transition hover:border-red-400/60 hover:text-red-300"
            >
              <Trash2 className="size-3.5" />
              删除项目
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {step === "story" ? (
          <StorySetupTab project={project} onProjectChange={setProject} reload={reload} />
        ) : (
          <StoryboardTab project={project} onProjectChange={setProject} reload={reload} />
        )}
      </main>

      <DestructiveConfirmModal
        open={confirmDelete}
        content={{
          step1Title: `删除项目「${project.name}」`,
          step1Body: (
            <>
              <p>项目将被移到回收态（软删），无法在创作室中再次访问。</p>
            </>
          ),
          step2Title: "确认删除？此操作不可恢复",
          step2Body: (
            <>
              <p className="text-red-300">删除后不可恢复。</p>
              <p className="text-sm text-white/85">
                项目下所有封面图、角色头像、分镜图与分镜视频（云端存储 OSS）将全部异步清理。
              </p>
            </>
          ),
        }}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!base) return;
          try {
            await apiDeleteProject(base, project.id);
          } catch (e) {
            console.warn("delete project failed", e);
          }
          setConfirmDelete(false);
          router.push("/projects");
        }}
      />
    </div>
  );
}
