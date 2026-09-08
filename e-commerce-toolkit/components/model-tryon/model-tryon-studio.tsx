"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { VtonRefWorkbench } from "@/components/vton/vton-ref-workbench";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import { formatEcomImageGenUserMessage } from "@/lib/ecom-image-gen-user-error";
import {
  attachModelTryonRefs,
  batchModelTryon,
  buildModelTryonCartesianLooks,
  createModelTryonProject,
  expandModelTryonFullBody,
  fetchModelTryonModels,
  generateModelTryonModel,
  getModelTryonProject,
  listModelTryonProjectSummaries,
  lockModelTryonResults,
  patchModelTryonGarments,
  patchModelTryonLooks,
  saveModelTryonToAssets,
  setModelTryonDefaultLockedLook,
  unlockModelTryonLockedLook,
  updateModelTryonProject,
  uploadModelTryonGarment,
  uploadModelTryonRefImage,
} from "@/lib/ecom-model-tryon-api";
import type { ModelTryonProject } from "@/lib/ecom-model-tryon-api";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { parseVtonTryonProgress } from "@/lib/vton-tryon-progress";
import type { VtonGarmentKind, VtonLookSpec } from "@/lib/vton-types";
import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import { Plus } from "lucide-react";

const PROJECT_STORAGE_KEY = "ecom-model-tryon-active-project";

export function ModelTryonStudio() {
  const { alert, toast } = useDialogs();
  const [project, setProject] = useState<ModelTryonProject | null>(null);
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModelKey, setImageModelKey] = useState("wanx2.1-t2i-turbo");
  const [fusionModelKey, setFusionModelKey] = useState("qwen-image-edit");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const [tryonBusy, setTryonBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const tryonPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyProject = useCallback((p: ModelTryonProject) => {
    setProject(p);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PROJECT_STORAGE_KEY, p.id);
    }
  }, []);

  const vtonMeta = project?.meta ?? { garmentPool: [], lookDrafts: [], lockedLooks: [] };

  const tryonProgress = useMemo(
    () => parseVtonTryonProgress(project?.meta?.tryonProgress),
    [project?.meta?.tryonProgress],
  );

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const models = await fetchModelTryonModels();
      setImageModels(models.imageModels);
      setImageModelKey(
        pickBoundStoryboardModelKey(
          models.imageModels,
          models.defaults?.image ?? "wanx2.1-t2i-turbo",
        ),
      );
      setFusionModelKey(
        pickBoundStoryboardModelKey(
          models.fusionModels,
          models.defaults?.fusion ?? "qwen-image-edit",
        ),
      );
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

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

  async function handleBatchTryon() {
    if (!project) return;
    setTryonBusy(true);
    startTryonPoll(project.id);
    try {
      applyProject(await batchModelTryon(project.id));
      await toast({ title: "批量试衣完成", message: "可在结果墙锁定参考", variant: "success" });
    } catch (e) {
      await alert({ title: "批量试衣失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      stopTryonPoll();
      setTryonBusy(false);
    }
  }

  async function handleSaveToAssets() {
    if (!project) return;
    setSaveBusy(true);
    try {
      await saveModelTryonToAssets(project.id);
      await toast({ title: "已保存", message: "试衣成片已写入我的资产", variant: "success" });
    } catch (e) {
      await alert({ title: "保存失败", message: formatEcomTransportError(e), variant: "error" });
    } finally {
      setSaveBusy(false);
    }
  }

  async function patchSettings(patch: {
    outfitRefMode?: OutfitRefMode;
    garmentMode?: OutfitGarmentMode;
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
  const useBatch = outfitRefMode === "need_tryon";

  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-5">
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
          tryonBusy={tryonBusy}
          tryonProgress={tryonProgress}
          imageModels={imageModels}
          imageModelKey={imageModelKey}
          fusionModelKey={fusionModelKey}
          modelsLoading={modelsLoading}
          onOutfitRefModeChange={(mode) => void patchSettings({ outfitRefMode: mode })}
          onGarmentModeChange={(mode) => void patchSettings({ garmentMode: mode })}
          onUploadModel={async (file) => {
            setRefBusy(true);
            try {
              applyProject(await uploadModelTryonRefImage(project.id, "model", file));
            } catch (e) {
              await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
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
            }
          }}
          onAttachModelFromAssets={async (assets) => {
            const asset = assets[0];
            if (!asset) return;
            setRefBusy(true);
            try {
              applyProject(
                await attachModelTryonRefs(project.id, {
                  model: { ossUrl: asset.ossUrl, source: "asset", label: asset.title ?? "我的资产" },
                }),
              );
            } catch (e) {
              await alert({ title: "选择资产失败", message: formatEcomTransportError(e), variant: "error" });
            } finally {
              setRefBusy(false);
            }
          }}
          onGenerateModel={async (opts) => {
            setRefBusy(true);
            try {
              applyProject(await generateModelTryonModel(project.id, opts));
            } catch (e) {
              await alert({
                title: "生成模特失败",
                message: formatEcomImageGenUserMessage(formatEcomTransportError(e)),
                variant: "error",
              });
            } finally {
              setRefBusy(false);
            }
          }}
          onExpandFullBody={async (opts) => {
            setRefBusy(true);
            try {
              applyProject(
                await expandModelTryonFullBody(project.id, {
                  prompt: opts.prompt,
                  modelKey: opts.modelKey,
                }),
              );
            } catch (e) {
              await alert({
                title: "生成全身图失败",
                message: formatEcomImageGenUserMessage(formatEcomTransportError(e)),
                variant: "error",
              });
            } finally {
              setRefBusy(false);
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
                  onUploadGarment: async (kind: VtonGarmentKind, file: File) => {
                    setRefBusy(true);
                    try {
                      applyProject(await uploadModelTryonGarment(project.id, kind, file));
                    } catch (e) {
                      await alert({ title: "上传失败", message: formatEcomTransportError(e), variant: "error" });
                    } finally {
                      setRefBusy(false);
                    }
                  },
                  onAddGarmentsFromAssets: async (kind, assets) => {
                    setRefBusy(true);
                    try {
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
                  onBatchTryon: handleBatchTryon,
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
