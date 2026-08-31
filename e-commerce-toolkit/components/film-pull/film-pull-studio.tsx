"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { BackgroundGenerationProvider, useBackgroundGeneration } from "@/components/generation";
import { FilmPullDock } from "@/components/film-pull/film-pull-dock";
import { FilmPullShotTable } from "@/components/film-pull/film-pull-shot-table";
import { FilmPullStepper } from "@/components/film-pull/film-pull-stepper";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomVideoPreviewDialog } from "@/components/media/ecom-video-preview-dialog";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { ECOM_DEFAULT_CHAT_MODEL_KEY } from "@/lib/ecom-assistant-models";
import {
  analyzeFilmPull,
  clearFilmPullMedia,
  createFilmPullProject,
  fetchFilmPullModels,
  generateFilmPullShotsBatch,
  getFilmPullProject,
  listFilmPullProjectSummaries,
  downloadFilmPullExportZip,
  renderFilmPullFinalVideo,
  renderFilmPullScript,
  updateFilmPullProject,
  uploadFilmPullCharacterRef,
  uploadFilmPullVideo,
} from "@/lib/ecom-film-pull-api";
import type { FilmPullProject, FilmPullShot } from "@/lib/film-pull-types";
import { resolveFilmPullPhase } from "@/lib/film-pull-types";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const PROJECT_STORAGE_KEY = "ecom-film-pull-active-project";

export function FilmPullStudio() {
  return (
    <BackgroundGenerationProvider>
      <FilmPullStudioInner />
    </BackgroundGenerationProvider>
  );
}

function FilmPullStudioInner() {
  const { alert, toast } = useDialogs();
  const backgroundGen = useBackgroundGeneration();
  const longJobRef = useRef<Promise<FilmPullProject> | null>(null);
  const [project, setProject] = useState<FilmPullProject | null>(null);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [videoModels, setVideoModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModelKey, setChatModelKey] = useState(ECOM_DEFAULT_CHAT_MODEL_KEY);
  const [videoModelKey, setVideoModelKey] = useState("wan2.7-r2v");
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [editedShots, setEditedShots] = useState<FilmPullShot[] | null>(null);
  const [characterDescription, setCharacterDescription] = useState("");
  const [previewVideo, setPreviewVideo] = useState<{ src: string; title?: string } | null>(null);
  const [modelPicker, setModelPicker] = useState<"chat" | "video" | null>(null);

  const phase = useMemo(() => resolveFilmPullPhase(project), [project]);
  const shots =
    editedShots ?? project?.analyzeResult?.structured?.shots ?? [];

  const applyProject = useCallback((p: FilmPullProject) => {
    setProject(p);
    setEditedShots(p.analyzeResult?.structured?.shots ?? null);
    if (typeof window !== "undefined") sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    if (p.settings.chatModelKey) setChatModelKey(p.settings.chatModelKey);
    if (p.settings.videoModelKey) setVideoModelKey(p.settings.videoModelKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchFilmPullModels()
      .then((m) => {
        if (cancelled) return;
        setChatModels(m.chatModels);
        setVideoModels(m.videoModels);
        setChatModelKey((prev) =>
          pickBoundStoryboardModelKey(m.chatModels, m.defaults?.chat ?? prev),
        );
        setVideoModelKey((prev) =>
          pickBoundStoryboardModelKey(m.videoModels, m.defaults?.video ?? prev),
        );
      })
      .catch((e) => {
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
      });

    (async () => {
      try {
        const savedId =
          typeof window !== "undefined" ? sessionStorage.getItem(PROJECT_STORAGE_KEY) : null;
        const p = savedId
          ? await getFilmPullProject(savedId)
          : await createFilmPullProject({ title: "专业拉片" });
        if (!cancelled) applyProject(p);
      } catch (e) {
        if (isEcomUnauthorizedError(e)) setNeedLogin(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyProject]);

  const wrapBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      await alert({
        title: "操作失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const startLongJob = useCallback(
    (
      taskId: string,
      label: string,
      expectedDurationMs: number,
      job: () => Promise<FilmPullProject>,
      successMessage: string,
    ) => {
      longJobRef.current = job().then((p) => {
        applyProject(p);
        return p;
      });
      backgroundGen.registerTask({
        id: taskId,
        label,
        startedAt: new Date().toISOString(),
        expectedDurationMs,
        poll: async () => {
          const pending = longJobRef.current;
          if (!pending) return { status: "running" as const };
          try {
            await pending;
            return { status: "succeeded" as const };
          } catch (e) {
            return {
              status: "failed" as const,
              error: e instanceof Error ? e.message : "任务失败",
            };
          }
        },
        onSucceeded: async () => {
          longJobRef.current = null;
          await toast({ variant: "success", title: successMessage });
        },
        onFailed: async () => {
          longJobRef.current = null;
        },
      });
    },
    [applyProject, backgroundGen, toast],
  );

  if (needLogin) return <EcomLoginPrompt />;
  if (loading || !project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#6e6e73]">
        加载中…
      </div>
    );
  }

  const finalUrl =
    project.renderPlan?.render?.finalVideoUrl ?? project.meta?.finalVideoUrl ?? null;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[#e8e8ed] px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-[#1d1d1f]">专业拉片</h1>
            <p className="text-xs text-[#6e6e73]">工业化逐镜分析 · 换角 · 合成成片（≤60s）</p>
          </div>
          <div className="flex items-center gap-2">
            <EcomButtonSecondary size="sm" onClick={() => setModelPicker("chat")}>
              拉片模型
            </EcomButtonSecondary>
            <EcomButtonSecondary size="sm" onClick={() => setModelPicker("video")}>
              出镜模型
            </EcomButtonSecondary>
            <EcomProjectListButton
              loadProjects={listFilmPullProjectSummaries}
              onSelect={async (id) => applyProject(await getFilmPullProject(id))}
              onNew={async () => applyProject(await createFilmPullProject())}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <FilmPullStepper phase={phase} />

          {project.analyzeResult?.parseError && (
            <p className="rounded-lg bg-[#fff5f5] px-3 py-2 text-xs text-[#ff3b30]">
              {project.analyzeResult.parseError}
            </p>
          )}

          {phase !== "output" || !finalUrl ? (
            <FilmPullShotTable
              shots={shots}
              editable={phase === "review"}
              onChange={setEditedShots}
            />
          ) : null}

          {project.renderPlan?.shots.some((s) => s.videoUrl) && (
            <div className="rounded-xl border border-[#e8e8ed] bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">逐镜预览</h2>
              <div className="flex gap-2 overflow-x-auto">
                {project.renderPlan!.shots
                  .filter((s) => s.videoUrl)
                  .map((s) => (
                    <button
                      key={s.shotNo}
                      type="button"
                      className="shrink-0 rounded-lg border border-[#e8e8ed] p-1"
                      onClick={() =>
                        setPreviewVideo({ src: s.videoUrl!, title: `镜 ${s.shotNo}` })
                      }
                    >
                      <video
                        src={s.videoUrl}
                        className="h-20 w-32 rounded object-cover"
                        muted
                      />
                      <p className="mt-1 text-center text-[10px]">镜 {s.shotNo}</p>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {finalUrl && (
            <div className="rounded-xl border border-[#e8e8ed] bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">成片</h2>
              <button
                type="button"
                onClick={() => setPreviewVideo({ src: finalUrl, title: "合成成片" })}
              >
                <video src={finalUrl} className="max-h-64 rounded-lg" controls muted />
              </button>
            </div>
          )}
        </div>

        <FilmPullDock
          phase={phase}
          media={project.media}
          characterRefs={project.characterRefs}
          mediaBusy={mediaBusy}
          busy={busy}
          characterDescription={characterDescription}
          onCharacterDescriptionChange={setCharacterDescription}
          analyzeDisabled={!project.media?.ossUrl}
          onUploadVideo={(file) => {
            void (async () => {
              setMediaBusy(true);
              try {
                applyProject(await uploadFilmPullVideo(project.id, file));
              } catch (e) {
                await alert({
                  title: "上传失败",
                  message: e instanceof Error ? e.message : "请重试",
                  variant: "error",
                });
              } finally {
                setMediaBusy(false);
              }
            })();
          }}
          onClearVideo={() => {
            void wrapBusy(async () => {
              applyProject(await clearFilmPullMedia(project.id));
            });
          }}
          onUploadCharacter={(file) => {
            void wrapBusy(async () => {
              applyProject(await uploadFilmPullCharacterRef(project.id, file));
            });
          }}
          onAnalyze={() => {
            void wrapBusy(async () => {
              const p = await analyzeFilmPull(project.id, { modelKey: chatModelKey });
              applyProject(p);
              if (p.analyzeResult?.structured) {
                await toast({ variant: "success", title: "拉片完成", message: "请审校分镜表" });
              }
            });
          }}
          onSaveShots={() => {
            if (!editedShots) return;
            void wrapBusy(async () => {
              applyProject(await updateFilmPullProject(project.id, { shots: editedShots }));
              await toast({ variant: "success", title: "已保存审校" });
            });
          }}
          onRenderScript={() => {
            void wrapBusy(async () => {
              const p = await renderFilmPullScript(project.id, {
                characterDescription,
                modelKey: chatModelKey,
              });
              applyProject(p);
              await toast({ variant: "success", title: "渲染脚本已生成" });
            });
          }}
          onBatchGenerate={() => {
            const shotCount = project.renderPlan?.shots.length ?? shots.length;
            startLongJob(
              `film-pull-batch-${project.id}`,
              shotCount > 1 ? `批量出镜 · ${shotCount} 镜` : "批量出镜",
              Math.max(shotCount, 1) * 180_000,
              () => generateFilmPullShotsBatch(project.id, { modelKey: videoModelKey }),
              "批量出镜已完成",
            );
          }}
          onFinalRender={() => {
            startLongJob(
              `film-pull-render-${project.id}`,
              "合成成片",
              240_000,
              () => renderFilmPullFinalVideo(project.id),
              "成片合成完成",
            );
          }}
          onExportZip={() => {
            void wrapBusy(async () => {
              await downloadFilmPullExportZip(project.id);
            });
          }}
        />
      </div>

      <StoryboardModelPickerDialog
        open={modelPicker === "chat"}
        mode="image"
        models={chatModels}
        selectedModelKey={chatModelKey}
        onClose={() => setModelPicker(null)}
        onConfirm={(key) => {
          setChatModelKey(key);
          setModelPicker(null);
        }}
      />
      <StoryboardModelPickerDialog
        open={modelPicker === "video"}
        mode="video"
        videoTarget="panel"
        models={videoModels}
        selectedModelKey={videoModelKey}
        onClose={() => setModelPicker(null)}
        onConfirm={(key) => {
          setVideoModelKey(key);
          setModelPicker(null);
        }}
      />

      <EcomVideoPreviewDialog
        open={Boolean(previewVideo)}
        src={previewVideo?.src ?? ""}
        title={previewVideo?.title}
        onClose={() => setPreviewVideo(null)}
      />
    </>
  );
}
