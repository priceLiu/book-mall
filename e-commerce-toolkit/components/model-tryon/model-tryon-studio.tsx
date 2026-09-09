"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import type { VtonBatchTryonMode } from "@/components/vton/vton-results-grid";
import {
  isEcomTransportDisconnectError,
  runVtonBatchTryonWithPoll,
  vtonBatchTryonFailureMessage,
} from "@/lib/vton-batch-tryon-run";
import {
  shouldClearVtonLookSelectionAfterBatch,
  useVtonLookSelectionSync,
} from "@/lib/vton-look-selection";
import { VtonRefWorkbench } from "@/components/vton/vton-ref-workbench";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import { formatEcomImageGenUserMessage } from "@/lib/ecom-image-gen-user-error";
import {
  attachModelTryonRefs,
  batchModelTryon,
  cancelModelTryonBatch,
  buildModelTryonCartesianLooks,
  createModelTryonProject,
  expandModelTryonFullBody,
  generateModelTryonModel,
  getModelTryonProject,
  listModelTryonProjectSummaries,
  lockModelTryonResults,
  patchModelTryonGarments,
  patchModelTryonLooks,
  confirmModelTryonGeneration,
  removeModelTryonGeneration,
  saveModelTryonModelImage,
  saveModelTryonToAssets,
  setActiveModelTryonGeneration,
  setPreviewModelTryonGeneration,
  unconfirmModelTryonGeneration,
  setModelTryonDefaultLockedLook,
  unlockModelTryonLockedLook,
  updateModelTryonProject,
  uploadModelTryonGarment,
  uploadModelTryonRefImage,
} from "@/lib/ecom-model-tryon-api";
import type { ModelTryonProject } from "@/lib/ecom-model-tryon-api";
import { mergeVtonTryonProgressWithBatch, parseVtonTryonProgress } from "@/lib/vton-tryon-progress";
import { buildFullSetAssetPatch } from "@/lib/vton-full-set-garment";
import { coerceVtonModelImageSize, type VtonModelImageSize } from "@/lib/vton-image-quality";
import type { VtonGarmentKind, VtonLookSpec } from "@/lib/vton-types";
import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import { Plus } from "lucide-react";

const PROJECT_STORAGE_KEY = "ecom-model-tryon-active-project";

export function ModelTryonStudio() {
  const { alert, confirm, toast } = useDialogs();
  const [project, setProject] = useState<ModelTryonProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [tryonBusy, setTryonBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [selectedLookIds, setSelectedLookIds] = useState<string[]>([]);
  const [runningLookIds, setRunningLookIds] = useState<string[]>([]);
  const [modelPipelineBusy, setModelPipelineBusy] = useState<
    "uploading" | "importing-model" | "generating-model" | "expanding-full-body" | null
  >(null);
  const tryonPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);

  const applyProject = useCallback((p: ModelTryonProject) => {
    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
  }, []);

  const uploadModelFiles = useCallback(
    async (files: File[]) => {
      if (!project || files.length < 1) return;
      setRefBusy(true);
      setModelPipelineBusy("uploading");
      try {
        for (const file of files) {
          applyProject(await uploadModelTryonRefImage(project.id, "model", file));
        }
      } catch (e) {
        await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
      } finally {
        setRefBusy(false);
        setModelPipelineBusy(null);
      }
    },
    [project, applyProject, alert],
  );

  const vtonMeta = project?.meta ?? { garmentPool: [], lookDrafts: [], lockedLooks: [] };

  const tryonProgress = useMemo(
    () =>
      mergeVtonTryonProgressWithBatch(
        parseVtonTryonProgress(project?.meta?.tryonProgress),
        project?.meta?.tryonBatch,
      ),
    [project?.meta?.tryonProgress, project?.meta?.tryonBatch],
  );

  const lookDraftIdSig = useMemo(
    () => (project?.meta?.lookDrafts ?? []).map((l) => l.id).join("|"),
    [project?.meta?.lookDrafts],
  );

  useVtonLookSelectionSync(lookDraftIdSig, setSelectedLookIds);

  useEffect(() => {
    return () => {
      if (tryonPollRef.current) clearInterval(tryonPollRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const stored =
          typeof window !== "undefined" ? sessionStorage.getItem(PROJECT_STORAGE_KEY) : null;
        const p = stored
          ? await getModelTryonProject(stored)
          : await createModelTryonProject();
        if (!cancelled) applyProject(p);
      } catch (e) {
        if (isEcomUnauthorizedError(e)) {
          if (!cancelled) setNeedLogin(true);
        } else {
          try {
            const p = await createModelTryonProject();
            if (!cancelled) applyProject(p);
          } catch (inner) {
            if (isEcomUnauthorizedError(inner) && !cancelled) setNeedLogin(true);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyProject]);

  async function handleNewProject() {
    applyProject(await createModelTryonProject());
    setSelectedResultIds([]);
  }

  async function handleOpenProject(id: string) {
    applyProject(await getModelTryonProject(id));
    setSelectedResultIds([]);
  }

  function stopTryonPoll() {
    if (tryonPollRef.current) {
      clearInterval(tryonPollRef.current);
      tryonPollRef.current = null;
    }
  }

  function startTryonPoll(projectId: string) {
    stopTryonPoll();
    tryonPollRef.current = setInterval(() => {
      void getModelTryonProject(projectId)
        .then(applyProject)
        .catch(() => undefined);
    }, 2200);
  }

  async function runBatchTryon(looks: VtonLookSpec[]) {
    if (!project || looks.length < 1) {
      await alert({ title: "请先选择搭配", message: "在编排表左侧勾选至少 1 套搭配", variant: "error" });
      return;
    }
    setRunningLookIds(looks.map((l) => l.id));
    setTryonBusy(true);
    const ac = new AbortController();
    batchAbortRef.current = ac;
    try {
      const { project: finalProject, postError } = await runVtonBatchTryonWithPoll({
        startBatch: (signal) => batchModelTryon(project.id, { looks, signal }),
        fetchProject: () => getModelTryonProject(project.id),
        readBatch: (p) => p.meta?.tryonBatch,
        applyProject,
        signal: ac.signal,
      });
      const batch = finalProject.meta?.tryonBatch;
      if (shouldClearVtonLookSelectionAfterBatch(batch?.status)) {
        setSelectedLookIds([]);
      }
      if (batch?.status === "cancelled") {
        await toast({
          title: "已停止",
          message: batch.label ?? "批量试衣已停止，已完成的结果已保留",
        });
        return;
      }
      if (batch?.status === "done") {
        await toast({ title: "批量试衣完成", message: "可在结果墙锁定参考", variant: "success" });
        return;
      }
      if (postError && !isEcomTransportDisconnectError(postError)) {
        await alert({
          title: "批量试衣失败",
          message: vtonBatchTryonFailureMessage(postError, batch?.label),
          variant: "error",
        });
      } else if (batch?.status === "failed") {
        await alert({
          title: "批量试衣失败",
          message: batch.label ?? "部分试衣失败，可逐套重试",
          variant: "error",
        });
      }
    } catch (e) {
      if (ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        try {
          applyProject(await getModelTryonProject(project.id));
        } catch {
          /* ignore */
        }
        return;
      }
      await alert({ title: "批量试衣", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      batchAbortRef.current = null;
      setTryonBusy(false);
      setRunningLookIds([]);
      setSelectedLookIds([]);
    }
  }

  async function handleBatchTryon(mode: VtonBatchTryonMode) {
    if (!project) return;
    const allLooks = project.meta?.lookDrafts ?? [];
    const looks =
      mode === "all"
        ? allLooks
        : allLooks.filter((l) => selectedLookIds.includes(l.id));
    await runBatchTryon(looks);
  }

  async function handleRegenerateLook(lookId: string) {
    if (!project) return;
    const look = (project.meta?.lookDrafts ?? []).find((l) => l.id === lookId);
    if (!look) return;
    await runBatchTryon([look]);
  }

  function toggleLookSelection(lookId: string) {
    setSelectedLookIds((prev) =>
      prev.includes(lookId) ? prev.filter((id) => id !== lookId) : [...prev, lookId],
    );
  }

  async function handleStopBatchTryon() {
    if (!project) return;
    if (
      !(await confirm({
        title: "停止批量试衣",
        message: "确定停止？已完成的结果会保留，未完成的将取消。",
      }))
    ) {
      return;
    }
    try {
      applyProject(await cancelModelTryonBatch(project.id));
      batchAbortRef.current?.abort();
      await toast({ title: "正在停止", message: "已发送停止请求，已完成的结果会保留" });
    } catch (e) {
      await alert({ title: "停止失败", message: formatEcomTransportError(e), variant: "error" });
    }
  }

  async function handleSaveToAssets() {
    if (!project) return;
    setSaveBusy(true);
    try {
      await saveModelTryonToAssets(project.id);
      await toast({
        title: "已保存",
        message: "试衣成片已写入「我的资产 → 试衣库」",
        variant: "success",
      });
    } catch (e) {
      await alert({ title: "保存失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setSaveBusy(false);
    }
  }

  async function patchSettings(patch: {
    outfitRefMode?: OutfitRefMode;
    garmentMode?: OutfitGarmentMode;
    modelImageSize?: VtonModelImageSize;
  }) {
    if (!project) return;
    applyProject(
      await updateModelTryonProject(project.id, {
        settings: { ...project.settings, ...patch },
      }),
    );
  }

  function toggleResultSelection(resultId: string) {
    setSelectedResultIds((prev) =>
      prev.includes(resultId) ? prev.filter((id) => id !== resultId) : [...prev, resultId],
    );
  }

  if (needLogin) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <EcomLoginPrompt returnPath="/ecom/model-tryon" />
      </EcomWorkspaceLayout>
    );
  }

  if (loading || !project) {
    return (
      <EcomWorkspaceLayout fullWidth>
        <div className="flex h-full min-h-0 animate-pulse flex-col gap-4 p-5">
          <div className="h-10 w-48 rounded-lg bg-[#e8e8ed]" />
          <div className="h-64 rounded-xl bg-[#f0f0f2]" />
        </div>
      </EcomWorkspaceLayout>
    );
  }

  const outfitRefMode = project.settings.outfitRefMode ?? "need_tryon";
  const garmentMode = project.settings.garmentMode ?? "two_piece";
  const modelImageSize = coerceVtonModelImageSize(project.settings.modelImageSize);
  const useBatch = outfitRefMode === "need_tryon";

  return (
    <EcomWorkspaceLayout fullWidth contentClassName="overflow-y-auto">
      <div className="flex min-h-full w-full flex-col gap-4 p-4 md:p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-[#1d1d1f]">模特试衣</h1>
            <p className="text-xs text-[#6e6e73]">
              服装池 + 最多 9 套搭配批量试衣，锁定后可保存到资产库。
            </p>
          </div>
          <EcomIconToolbar>
            <EcomIconToolbarGroup label="项目">
              <EcomIconButton
                label="新建项目"
                icon={Plus}
                disabled={refBusy || tryonBusy}
                onClick={() => void handleNewProject()}
              />
              <EcomProjectListButton
                currentProjectId={project.id}
                loadProjects={async () => {
                  const items = await listModelTryonProjectSummaries();
                  return items.map((p) => ({
                    id: p.id,
                    title: p.title ?? "模特试衣",
                    updatedAt: p.updatedAt,
                    subtitle: "模特试衣",
                  }));
                }}
                onSelectProject={async (id: string) => {
                  await handleOpenProject(id);
                }}
                title="模特试衣 · 项目列表"
                emptyHint="还没有保存过的模特试衣项目。"
              />
            </EcomIconToolbarGroup>
          </EcomIconToolbar>
        </div>

        <VtonRefWorkbench
          mode="model-tryon"
          refs={project.references}
          outfitRefMode={outfitRefMode}
          garmentMode={garmentMode}
          busy={refBusy}
          modelPipelineBusy={modelPipelineBusy}
          tryonBusy={tryonBusy}
          tryonProgress={tryonProgress}
          builtinModelPipeline
          vtonMeta={vtonMeta}
          onSelectPreviewModelGeneration={async (generationId) => {
            if (!project) return;
            try {
              applyProject(await setPreviewModelTryonGeneration(project.id, generationId));
            } catch (e) {
              await alert({ title: "切换预览失败", message: formatEcomTransportError(e), variant: "error" });
            }
          }}
          onConfirmModelGeneration={async (generationId) => {
            if (!project) return;
            setRefBusy(true);
            try {
              applyProject(await confirmModelTryonGeneration(project.id, generationId));
              await toast({
                title: "已加入待试衣",
                message: "该模特已进入右侧待试衣列表，可切换试衣。",
                variant: "success",
              });
            } catch (e) {
              await alert({ title: "确认失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
          onSelectTryonModelGeneration={async (generationId) => {
            if (!project) return;
            try {
              applyProject(await setActiveModelTryonGeneration(project.id, generationId));
            } catch (e) {
              await alert({ title: "切换试衣模特失败", message: formatEcomTransportError(e), variant: "error" });
            }
          }}
          onUnconfirmModelGeneration={async (generationId) => {
            if (!project) return;
            const ok = await confirm({
              title: "移出待试衣？",
              message: "该模特将从右侧待试衣列表移除，左栏上传历史仍保留。",
            });
            if (!ok) return;
            setRefBusy(true);
            try {
              applyProject(await unconfirmModelTryonGeneration(project.id, generationId));
            } catch (e) {
              await alert({ title: "移出失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
          onSaveModelToMyModels={async (ossUrl, title) => {
            if (!project) return;
            try {
              await saveModelTryonModelImage(project.id, { ossUrl, title });
              await toast({
                title: "已保存",
                message: "模特图已写入「我的资产 → 我的模特」",
                variant: "success",
              });
            } catch (e) {
              await alert({ title: "保存失败", message: formatEcomTransportError(e), variant: "error" });
            }
          }}
          onDeleteModelGeneration={async (generationId) => {
            if (!project) return;
            const ok = await confirm({
              title: "从本项目移除该模特图？",
              message: "仅移除当前项目「模特列表」中的这一张，不会删除「我的模特」库中已保存的条目。",
            });
            if (!ok) return;
            setRefBusy(true);
            try {
              applyProject(await removeModelTryonGeneration(project.id, generationId));
            } catch (e) {
              await alert({ title: "移除失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
          modelImageSize={modelImageSize}
          onModelImageSizeChange={(size) => void patchSettings({ modelImageSize: size })}
          onOutfitRefModeChange={(mode) => void patchSettings({ outfitRefMode: mode })}
          onGarmentModeChange={(mode) => void patchSettings({ garmentMode: mode })}
          onUploadModels={uploadModelFiles}
          onUploadModel={async (file) => uploadModelFiles([file])}
          onUploadClothing={async (file) => {
            setRefBusy(true);
            try {
              applyProject(await uploadModelTryonRefImage(project.id, "clothing", file));
            } catch (e) {
              await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
          onUploadTopGarment={async (file) => {
            setRefBusy(true);
            try {
              applyProject(await uploadModelTryonRefImage(project.id, "topGarment", file));
            } catch (e) {
              await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
          onUploadBottomGarment={async (file) => {
            setRefBusy(true);
            try {
              applyProject(await uploadModelTryonRefImage(project.id, "bottomGarment", file));
            } catch (e) {
              await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
          onPickModelFromLibrary={async (ossUrl, label) => {
            setRefBusy(true);
            setModelPipelineBusy("importing-model");
            try {
              applyProject(
                await attachModelTryonRefs(project.id, {
                  model: { ossUrl, source: "library", label: label ?? "模特库" },
                }),
              );
            } catch (e) {
              await alert({ title: "选择模特失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
              setModelPipelineBusy(null);
            }
          }}
          onAttachModelFromAssets={async (assets) => {
            if (!assets.length) return;
            setRefBusy(true);
            setModelPipelineBusy("importing-model");
            try {
              for (const asset of assets) {
                applyProject(
                  await attachModelTryonRefs(project.id, {
                    model: {
                      ossUrl: asset.ossUrl,
                      source: "asset",
                      label: asset.title ?? "我的模特",
                    },
                  }),
                );
              }
            } catch (e) {
              await alert({ title: "选择资产失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
              setModelPipelineBusy(null);
            }
          }}
          onGenerateModel={async (opts) => {
            setRefBusy(true);
            setModelPipelineBusy("generating-model");
            try {
              applyProject(
                await generateModelTryonModel(project.id, {
                  ...opts,
                  imageSize: opts?.imageSize ?? modelImageSize,
                }),
              );
            } catch (e) {
              await alert({
                title: "生成全身模特失败",
                message: formatEcomImageGenUserMessage(formatEcomTransportError(e)),
                variant: "error",
              });
            } finally {
              setRefBusy(false);
              setModelPipelineBusy(null);
            }
          }}
          onExpandFullBody={async (opts) => {
            setRefBusy(true);
            setModelPipelineBusy("expanding-full-body");
            try {
              applyProject(
                await expandModelTryonFullBody(project.id, {
                  ...opts,
                  imageSize: opts?.imageSize ?? modelImageSize,
                }),
              );
              await toast({
                title: "全身图已生成",
                message: "新图已加入左侧上传历史；原头像仍保持选中，可点缩略图切换查看。",
                variant: "success",
              });
            } catch (e) {
              await alert({
                title: "生成全身图失败",
                message: formatEcomImageGenUserMessage(formatEcomTransportError(e)),
                variant: "error",
              });
            } finally {
              setRefBusy(false);
              setModelPipelineBusy(null);
            }
          }}
          onTryon={async () => {}}
          onSaveToAssets={async () => {
            await handleSaveToAssets();
          }}
          saveBusy={saveBusy}
          batchWorkflow={
            useBatch
              ? {
                  meta: vtonMeta,
                  selectedResultIds,
                  onToggleResult: toggleResultSelection,
                  onUploadGarment: async (kind, file, opts) => {
                    setRefBusy(true);
                    try {
                      applyProject(await uploadModelTryonGarment(project.id, kind, file, opts));
                    } catch (e) {
                      await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  onAddGarmentsFromAssets: async (kind, assets, opts) => {
                    setRefBusy(true);
                    try {
                      if (kind === "full_set" && opts?.fullSetSlot) {
                        applyProject(
                          await patchModelTryonGarments(
                            project.id,
                            buildFullSetAssetPatch(assets, opts.fullSetSlot, opts.garmentId),
                          ),
                        );
                      } else {
                        applyProject(
                          await patchModelTryonGarments(project.id, {
                            add: assets.map((a) => ({
                              kind,
                              ossUrl: a.ossUrl,
                              label: a.title,
                              source: "asset",
                            })),
                          }),
                        );
                      }
                    } catch (e) {
                      await alert({ title: "添加失败", message: formatEcomTransportError(e), variant: "error" });
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  onRemoveGarments: async (ids) => {
                    setRefBusy(true);
                    try {
                      applyProject(await patchModelTryonGarments(project.id, { removeIds: ids }));
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  onChangeLooks: async (looks: VtonLookSpec[]) => {
                    setRefBusy(true);
                    try {
                      applyProject(await patchModelTryonLooks(project.id, looks));
                    } catch (e) {
                      await alert({ title: "保存搭配失败", message: formatEcomTransportError(e), variant: "error" });
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  onCartesianLooks: async (topIds, bottomIds) => {
                    setRefBusy(true);
                    try {
                      applyProject(await buildModelTryonCartesianLooks(project.id, topIds, bottomIds));
                    } catch (e) {
                      await alert({ title: "生成组合失败", message: formatEcomTransportError(e), variant: "error" });
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  selectedLookIds,
                  onToggleLookSelection: toggleLookSelection,
                  onSelectAllLooks: () =>
                    setSelectedLookIds((project.meta?.lookDrafts ?? []).map((l) => l.id)),
                  onClearLookSelection: () => setSelectedLookIds([]),
                  onBatchTryon: handleBatchTryon,
                  onRegenerateLook: handleRegenerateLook,
                  onSaveResultToAssets: async (ossUrl, title) => {
                    if (!project) return;
                    try {
                      await saveModelTryonToAssets(project.id, { ossUrl, title });
                      await toast({
                        title: "已保存",
                        message: "试衣成片已写入「我的资产 → 试衣库」",
                        variant: "success",
                      });
                    } catch (e) {
                      await alert({
                        title: "保存失败",
                        message: formatEcomTransportError(e),
                        variant: "error",
                      });
                    }
                  },
                  onStopBatchTryon: handleStopBatchTryon,
                  runningLookIds,
                  onLockSelected: async () => {
                    if (!selectedResultIds.length) return;
                    setRefBusy(true);
                    try {
                      applyProject(await lockModelTryonResults(project.id, selectedResultIds));
                      setSelectedResultIds([]);
                      await toast({ title: "已锁定", message: "参考已加入锁定列表", variant: "success" });
                    } catch (e) {
                      await alert({ title: "锁定失败", message: formatEcomTransportError(e), variant: "error" });
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  onSetDefaultLocked: async (lockedLookId) => {
                    setRefBusy(true);
                    try {
                      applyProject(await setModelTryonDefaultLockedLook(project.id, lockedLookId));
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  onUnlockLocked: async (lockedLookId) => {
                    setRefBusy(true);
                    try {
                      applyProject(await unlockModelTryonLockedLook(project.id, lockedLookId));
                    } finally {
                      setRefBusy(false);
                    }
                  },
                }
              : undefined
          }
        />
      </div>
    </EcomWorkspaceLayout>
  );
}
