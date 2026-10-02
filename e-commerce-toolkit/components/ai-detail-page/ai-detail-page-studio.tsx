"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AiDetailPageConfigSidebar } from "@/components/ai-detail-page/ai-detail-page-config-sidebar";
import {
  DetailPageSuiteContentPanel,
  DetailPageSuiteWorkbenchChrome,
  type DetailPageSuiteSlotImagePreviewPayload,
} from "@/components/detail-page-suite/detail-page-suite-content-panel";
import { DetailPageSuiteSizeChartEditDialog } from "@/components/detail-page-suite/detail-page-suite-size-chart-edit-dialog";
import { DetailPageSuiteSlotPromptEditDialog } from "@/components/detail-page-suite/detail-page-suite-slot-prompt-edit-dialog";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { EcomLoginPrompt } from "@/components/auth/ecom-login-prompt";
import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  addSizeChartDataSlotToModule,
  addSpecChartDataSlotToModule,
  canAddCustomSuiteSlot,
  isDetailPageSuiteSizeChartModuleId,
} from "@/lib/detail-page-suite-add-custom-slot";
import {
  resolveModuleDisplaySlots,
  syncSuiteModulesSlots,
} from "@/lib/detail-page-suite-module-slots";
import {
  appendDefaultSizeChartTableToBrief,
  ensureSizeChartBriefTableCount,
  isDetailPageSuiteSizeChartDataLabel,
  resolveSizeChartTableForSlot,
  resolveSizeChartTableIndexForLabel,
  upsertSizeChartTableInBrief,
} from "@/lib/detail-page-suite-size-chart";
import {
  appendDefaultSpecChartTableToBrief,
  ensureSpecChartBriefTableCount,
  isDetailPageSuiteSpecChartDataLabel,
  isDetailPageSuiteSpecChartModuleId,
  resolveSpecChartTableForSlot,
  resolveSpecChartTableIndexForLabel,
  upsertSpecChartTableInBrief,
} from "@/lib/detail-page-suite-spec-table";
import {
  detailPageSuitePromptSelectionAfterImageGenSubmit,
  listDetailPageSuitePromptGenTargets,
  resolveDetailPageSuiteBusyImageGenExcludeKeys,
  resolveDetailPageSuiteImageGenSlotKeys,
} from "@/lib/detail-page-suite-prompt-selection";
import { listDetailPageSuitePendingImageKeys } from "@/lib/detail-page-suite-pending";
import { formatEcomImageGenUserMessage } from "@/lib/ecom-image-gen-user-error";
import {
  createAiDetailPageProject,
  deleteAiDetailPageProject,
  fetchAiDetailPageModels,
  generateAiDetailPageImages,
  generateAiDetailPagePrompts,
  getAiDetailPageProject,
  listAiDetailPageSummaries,
  planAiDetailPageSlots,
  updateAiDetailPageProject,
  uploadAiDetailPageRef,
} from "@/lib/ecom-ai-detail-page-api";
import { formatEcomTransportError } from "@/lib/ecom-book-fetch";
import { resumeOrCreateEcomProject, writeEcomLastProjectId } from "@/lib/ecom-last-project";
import { ensureEcomSessionFresh } from "@/lib/ecom-silent-sso";
import { runEcomNewProjectWithSavePrompt } from "@/lib/ecom-new-project-save-prompt";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";
import { resolveDetailPageRatioFromProject } from "@/lib/ecom-generation-settings/detail-template";
import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";
import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const StoryboardModelPickerDialog = dynamic(
  () =>
    import("@/components/storyboard/storyboard-model-picker-dialog").then(
      (m) => m.StoryboardModelPickerDialog,
    ),
  { ssr: false },
);

const STORAGE_KEY = "ecom-ai-detail-page-active-project";
const RETURN_PATH = "/ecom/ai-detail-page";
const DEFAULT_IMAGE_MODEL = "wan2.7-image";

function allPromptTargetKeys(project: DetailPageSuiteProject): Set<string> {
  return new Set(listDetailPageSuitePromptGenTargets(project).map((t) => t.key));
}

export function AiDetailPageStudio() {
  const { alert, confirm, toast } = useDialogs();
  const [project, setProject] = useState<DetailPageSuiteProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [activeGenSlotKeys, setActiveGenSlotKeys] = useState<Set<string>>(new Set());
  const [promptSelectionKeys, setPromptSelectionKeys] = useState<Set<string>>(new Set());
  const [imageModels, setImageModels] = useState<StoryboardGatewayModel[]>([]);
  const [chatModels, setChatModels] = useState<StoryboardGatewayModel[]>([]);
  const [imageModelKey, setImageModelKey] = useState(DEFAULT_IMAGE_MODEL);
  const [chatModelKey, setChatModelKey] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slotImagePreview, setSlotImagePreview] =
    useState<DetailPageSuiteSlotImagePreviewPayload | null>(null);
  const [promptEdit, setPromptEdit] = useState<{
    moduleId: string;
    slotKey: string;
    prompt: string;
    label: string;
  } | null>(null);
  const [tableDataEdit, setTableDataEdit] = useState<{
    kind: "size" | "spec";
    moduleId: string;
    slotKey: string;
    label: string;
  } | null>(null);
  const [tableDataEditSaving, setTableDataEditSaving] = useState(false);
  const [loadGeneration, setLoadGeneration] = useState(0);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  const displayRatio = useMemo(
    () =>
      project
        ? resolveDetailPageRatioFromProject(project.brief, project.settings)
        : ("3:4" as EcomDetailPageRatio),
    [project?.brief, project?.settings],
  );

  const imageModelLabel = useMemo(
    () => imageModels.find((m) => m.modelKey === imageModelKey)?.displayName ?? imageModelKey,
    [imageModels, imageModelKey],
  );

  const syncActiveGenFromProject = useCallback((p: DetailPageSuiteProject) => {
    const pending = listDetailPageSuitePendingImageKeys(p);
    setActiveGenSlotKeys(new Set(pending));
  }, []);

  const reloadProject = useCallback(async () => {
    if (!project?.id) return;
    const fresh = await getAiDetailPageProject(project.id);
    setProject(fresh);
    syncActiveGenFromProject(fresh);
  }, [project?.id, syncActiveGenFromProject]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setNeedLogin(false);
      try {
        await ensureEcomSessionFresh();
        const models = await fetchAiDetailPageModels();
        if (cancelled) return;
        setImageModels(models.imageModels);
        setChatModels(models.chatModels);
        const imgKey = pickBoundStoryboardModelKey(
          models.imageModels,
          models.defaults.image || DEFAULT_IMAGE_MODEL,
        );
        const chatKey = pickBoundStoryboardModelKey(
          models.chatModels,
          models.defaults.chat || models.chatModels[0]?.modelKey || "",
        );
        setImageModelKey(imgKey);
        setChatModelKey(chatKey);

        const { project: loaded } = await resumeOrCreateEcomProject({
          storageKey: STORAGE_KEY,
          getById: getAiDetailPageProject,
          create: () => createAiDetailPageProject(),
          listRecentIds: async () => {
            const items = await listAiDetailPageSummaries();
            return items.map((i) => i.id);
          },
        });
        if (cancelled) return;
        setProject(loaded);
        writeEcomLastProjectId(STORAGE_KEY, loaded.id);
        syncActiveGenFromProject(loaded);
      } catch (e) {
        if (isEcomUnauthorizedError(e)) {
          setNeedLogin(true);
        } else {
          await alert({
            title: "加载失败",
            message: formatEcomTransportError(e),
            variant: "error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alert, loadGeneration, syncActiveGenFromProject]);

  async function persistImageModelSettings(modelKey: string) {
    if (!project) return;
    const updated = await updateAiDetailPageProject(project.id, {
      settings: { ...project.settings, imageModelKey: modelKey },
    });
    setProject(updated);
  }

  async function runImageGen(opts?: { moduleId?: string; slotKeys?: string[] }) {
    if (!project) return;
    if (project.references.length === 0) {
      await alert({
        title: "请先上传产品图",
        message: "上传至少一张产品参考图后再出图。",
        variant: "error",
      });
      return;
    }
    const excludeKeys = resolveDetailPageSuiteBusyImageGenExcludeKeys(
      project,
      activeGenSlotKeys,
    );
    const keys =
      opts?.slotKeys ??
      resolveDetailPageSuiteImageGenSlotKeys(project, promptSelectionKeys, {
        moduleId: opts?.moduleId,
        excludeKeys,
      });
    if (keys.length === 0) {
      await alert({
        title: "请先勾选要出图的点位",
        message: "勾选已有 Prompt 的格子后再生成。",
        variant: "error",
      });
      return;
    }
    setPromptSelectionKeys((prev) =>
      detailPageSuitePromptSelectionAfterImageGenSubmit(prev, keys),
    );
    setActiveGenSlotKeys((prev) => new Set([...prev, ...keys]));
    try {
      await persistImageModelSettings(imageModelKey);
      const result = await generateAiDetailPageImages(project.id, {
        moduleId: opts?.moduleId,
        slotKeys: keys,
        modelKey: imageModelKey,
        imageRatio: displayRatio,
        imageSize: project.settings.imageSize,
      });
      setProject(result.project);
      syncActiveGenFromProject(result.project);
      if (result.failures.length > 0) {
        await alert({
          title: "部分出图失败",
          message: result.failures.slice(0, 5).join("\n"),
          variant: "error",
        });
      } else {
        toast({ title: `已生成 ${result.generated} 张` });
      }
    } catch (e) {
      syncActiveGenFromProject(project);
      await alert({
        title: "出图失败",
        message: formatEcomImageGenUserMessage(e instanceof Error ? e.message : "出图失败"),
        variant: "error",
      });
    }
  }

  if (needLogin) return <EcomLoginPrompt returnPath={RETURN_PATH} />;
  if (loading) return <ProductCreationStudioSkeleton />;
  if (!project) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-[#515154]">未能打开工作台，请重试。</p>
      </div>
    );
  }

  return (
    <>
      <EcomWorkspaceLayout
        assistant={
          <AiDetailPageConfigSidebar
            project={project}
            disabled={uploadBusy || planning || prompting}
            planning={planning}
            prompting={prompting}
            imageModels={imageModels}
            imageModelKey={imageModelKey}
            onProjectChange={reloadProject}
            onOpenModelPicker={() => setModelPickerOpen(true)}
            onRequestPlanSlots={() => {
              void (async () => {
                setPlanning(true);
                try {
                  const updated = await planAiDetailPageSlots(project.id);
                  setProject(updated);
                  toast({ title: "点位已生成", message: "可在中栏查看占位格并生成 Prompt。" });
                } catch (e) {
                  await alert({
                    title: "生成点位失败",
                    message: e instanceof Error ? e.message : "失败",
                    variant: "error",
                  });
                } finally {
                  setPlanning(false);
                }
              })();
            }}
            onRequestPrompts={() => {
              void (async () => {
                setPrompting(true);
                try {
                  const updated = await generateAiDetailPagePrompts(project.id, {
                    modelKey: chatModelKey,
                  });
                  setProject(updated);
                  toast({ title: "Prompt 已生成" });
                } catch (e) {
                  await alert({
                    title: "生成 Prompt 失败",
                    message: e instanceof Error ? e.message : "失败",
                    variant: "error",
                  });
                } finally {
                  setPrompting(false);
                }
              })();
            }}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <DetailPageSuiteWorkbenchChrome
            project={project}
            variant="aplus"
            llmBusy={uploadBusy || planning || prompting}
            displayRatio={displayRatio}
            imageModelLabel={imageModelLabel}
            onPickImageModel={() => setModelPickerOpen(true)}
            onDisplayRatioChange={(ratio: EcomDetailPageRatio) => {
              void (async () => {
                const updated = await updateAiDetailPageProject(project.id, {
                  settings: { ...project.settings, imageRatio: ratio },
                });
                setProject(updated);
              })();
            }}
            onNewProject={async () => {
              await runEcomNewProjectWithSavePrompt({
                confirm,
                hasWorkToSave: true,
                save: async () => {},
                onProceed: async () => {
                  const created = await createAiDetailPageProject();
                  setProject(created);
                  writeEcomLastProjectId(STORAGE_KEY, created.id);
                  setPromptSelectionKeys(new Set());
                },
              });
            }}
            loadProjectList={async () => {
              const items = await listAiDetailPageSummaries();
              return items.map((it) => ({
                id: it.id,
                title: it.title?.trim() || "AI 详情页",
                updatedAt: it.updatedAt,
                thumbnailUrl: it.thumbnailUrl,
              }));
            }}
            onOpenProject={async (id) => {
              const p = await getAiDetailPageProject(id);
              setProject(p);
              writeEcomLastProjectId(STORAGE_KEY, id);
              syncActiveGenFromProject(p);
              setPromptSelectionKeys(new Set());
            }}
            onDeleteProject={async () => {
              if (
                !(await confirm({
                  title: "删除本项目？",
                  message: "将删除工作台中的 AI 详情页项目记录。",
                }))
              ) {
                return;
              }
              if (
                !(await confirm({
                  title: "不可恢复",
                  message: "删除后无法恢复，确认继续？",
                  variant: "destructive",
                }))
              ) {
                return;
              }
              await deleteAiDetailPageProject(project.id);
              const created = await createAiDetailPageProject();
              setProject(created);
              writeEcomLastProjectId(STORAGE_KEY, created.id);
            }}
          />

          <div className="ecom-scrollbar-overlay min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
          <div className="border-b border-[#e8e8ed] bg-[#fafafa] px-5 py-3">
            <EcomRefUploadCard
              title="产品参考图"
              items={project.references
                .filter((r) => r.role === "product")
                .map((r) => ({
                  id: r.id,
                  ossUrl: r.ossUrl,
                  label: r.label,
                  kind: "image" as const,
                }))}
              emptyHint="上传产品图 · 用于识图卖点与出图参考"
              busy={uploadBusy}
              onUploadFiles={(files) => {
                void (async () => {
                  setUploadBusy(true);
                  try {
                    let latest = project;
                    for (const file of files) {
                      latest = await uploadAiDetailPageRef(project.id, file);
                    }
                    setProject(latest);
                  } catch (e) {
                    await alert({
                      title: "上传失败",
                      message: e instanceof Error ? e.message : "上传失败",
                      variant: "error",
                    });
                  } finally {
                    setUploadBusy(false);
                  }
                })();
              }}
              onRemove={(id) => {
                void (async () => {
                  const refs = project.references.filter((r) => r.id !== id);
                  const updated = await updateAiDetailPageProject(project.id, { references: refs });
                  setProject(updated);
                })();
              }}
              onPreviewItem={(item) => setPreviewUrl(item.ossUrl)}
              onOpenFilePicker={() => productFileInputRef.current?.click()}
              inputRef={productFileInputRef}
            />
          </div>

          <DetailPageSuiteContentPanel
            variant="aplus"
            hideHeader
            project={project}
            llmBusy={uploadBusy || planning || prompting}
            activeGenSlotKeys={activeGenSlotKeys}
            promptSelectionKeys={promptSelectionKeys}
            onTogglePromptSelection={(key) => {
              setPromptSelectionKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onToggleAllPromptSelection={(selected) => {
              if (!selected) setPromptSelectionKeys(new Set());
              else setPromptSelectionKeys(allPromptTargetKeys(project));
            }}
            onGenerateModulePrompts={(moduleId) => {
              void (async () => {
                setPrompting(true);
                try {
                  const updated = await generateAiDetailPagePrompts(project.id, {
                    moduleId,
                    modelKey: chatModelKey,
                  });
                  setProject(updated);
                } catch (e) {
                  await alert({
                    title: "生成 Prompt 失败",
                    message: e instanceof Error ? e.message : "失败",
                    variant: "error",
                  });
                } finally {
                  setPrompting(false);
                }
              })();
            }}
            onGenerateModuleImages={(moduleId) => {
              void runImageGen({ moduleId });
            }}
            onUploadFiles={() => {}}
            onAttachAssets={() => {}}
            onRemoveRef={() => {}}
            onPreview={(url) => setPreviewUrl(url)}
            onPreviewSlotImage={setSlotImagePreview}
            onOpenPromptEdit={(moduleId, slotKey, prompt, label) => {
              if (isDetailPageSuiteSizeChartDataLabel(label)) {
                setTableDataEdit({ kind: "size", moduleId, slotKey, label });
                return;
              }
              if (isDetailPageSuiteSpecChartDataLabel(label)) {
                setTableDataEdit({ kind: "spec", moduleId, slotKey, label });
                return;
              }
              setPromptEdit({ moduleId, slotKey, prompt, label });
            }}
            onToggleModule={() => {}}
            onChangeCount={() => {}}
            onToggleItem={() => {}}
            onRequestAddItem={() => {}}
            onRequestAddSlot={(moduleId) => {
              void (async () => {
                if (!project) return;
                const check = canAddCustomSuiteSlot(project.suite, moduleId);
                if (!check.ok) {
                  await alert({
                    title: "无法新增点位",
                    message: check.reason,
                    variant: "error",
                  });
                  return;
                }
                const isSizeMod = isDetailPageSuiteSizeChartModuleId(moduleId);
                const isSpecMod = isDetailPageSuiteSpecChartModuleId(moduleId);
                if (!isSizeMod && !isSpecMod) {
                  await alert({
                    title: "暂不支持",
                    message: "请先在上方调整 N，并在子维度中勾选需要的点位。",
                    variant: "error",
                  });
                  return;
                }
                try {
                  const mod = project.suite.modules.find((m) => m.module_id === moduleId);
                  if (isSizeMod) {
                    const existingDataSlots =
                      mod == null
                        ? 0
                        : resolveModuleDisplaySlots(mod).filter((s) =>
                            isDetailPageSuiteSizeChartDataLabel(s.item_label),
                          ).length;
                    const briefBase = ensureSizeChartBriefTableCount(
                      project.brief,
                      existingDataSlots,
                    );
                    const { brief, label } = appendDefaultSizeChartTableToBrief(briefBase);
                    const modules = syncSuiteModulesSlots(
                      project.suite.modules.map((m) =>
                        m.module_id === moduleId
                          ? addSizeChartDataSlotToModule(m, label)
                          : m,
                      ),
                    );
                    const updated = await updateAiDetailPageProject(project.id, {
                      brief,
                      suite: { ...project.suite, modules },
                    });
                    setProject(updated);
                    toast({ title: "已新增尺码数据表点位" });
                    return;
                  }
                  const existingDataSlots =
                    mod == null
                      ? 0
                      : resolveModuleDisplaySlots(mod).filter((s) =>
                          isDetailPageSuiteSpecChartDataLabel(s.item_label),
                        ).length;
                  const briefBase = ensureSpecChartBriefTableCount(
                    project.brief,
                    existingDataSlots,
                  );
                  const { brief, label } = appendDefaultSpecChartTableToBrief(briefBase);
                  const modules = syncSuiteModulesSlots(
                    project.suite.modules.map((m) =>
                      m.module_id === moduleId
                        ? addSpecChartDataSlotToModule(m, label)
                        : m,
                    ),
                  );
                  const updated = await updateAiDetailPageProject(project.id, {
                    brief,
                    suite: { ...project.suite, modules },
                  });
                  setProject(updated);
                  toast({ title: "已新增参数数据表点位" });
                } catch (e) {
                  await alert({
                    title: "新增失败",
                    message: e instanceof Error ? e.message : "未知错误",
                    variant: "error",
                  });
                }
              })();
            }}
            onPickImageModel={() => setModelPickerOpen(true)}
            imageModelLabel={imageModelLabel}
            onActiveImageIndexChange={(moduleId, slotKey, index) => {
              void (async () => {
                const modules = project.suite.modules.map((m) => {
                  if (m.module_id !== moduleId) return m;
                  return {
                    ...m,
                    slots: m.slots.map((s) =>
                      s.item_key === slotKey ? { ...s, activeImageIndex: index } : s,
                    ),
                  };
                });
                const updated = await updateAiDetailPageProject(project.id, {
                  suite: { ...project.suite, modules },
                });
                setProject(updated);
              })();
            }}
          />
          </div>
        </div>
      </EcomWorkspaceLayout>

      <StoryboardModelPickerDialog
        open={modelPickerOpen}
        nativeOverlay
        onOpenChange={setModelPickerOpen}
        mode="image"
        dialogTitle="选择生图模型与参数"
        models={imageModels}
        value={imageModelKey}
        onChange={setImageModelKey}
        onConfirm={(modelKey) => {
          setModelPickerOpen(false);
          void persistImageModelSettings(modelKey);
        }}
      />

      {previewUrl ? (
        <EcomImagePreviewDialog
          open
          src={previewUrl}
          onOpenChange={(open) => {
            if (!open) setPreviewUrl(null);
          }}
        />
      ) : null}

      {slotImagePreview ? (
        <EcomImagePreviewDialog
          open
          src={slotImagePreview.src}
          title={slotImagePreview.title}
          items={slotImagePreview.items}
          initialIndex={slotImagePreview.initialIndex}
          onOpenChange={(open) => {
            if (!open) setSlotImagePreview(null);
          }}
        />
      ) : null}

      {tableDataEdit && project ? (
        <DetailPageSuiteSizeChartEditDialog
          open
          tableKind={tableDataEdit.kind}
          title={tableDataEdit.label}
          table={
            tableDataEdit.kind === "spec"
              ? resolveSpecChartTableForSlot(
                  project.brief,
                  resolveSpecChartTableIndexForLabel(tableDataEdit.label),
                )
              : resolveSizeChartTableForSlot(
                  project.brief,
                  resolveSizeChartTableIndexForLabel(tableDataEdit.label),
                )
          }
          saving={tableDataEditSaving}
          onOpenChange={(open) => {
            if (!open) setTableDataEdit(null);
          }}
          onSave={async (table) => {
            setTableDataEditSaving(true);
            try {
              const brief =
                tableDataEdit.kind === "spec"
                  ? upsertSpecChartTableInBrief(
                      project.brief,
                      resolveSpecChartTableIndexForLabel(tableDataEdit.label),
                      table,
                    )
                  : upsertSizeChartTableInBrief(
                      project.brief,
                      resolveSizeChartTableIndexForLabel(tableDataEdit.label),
                      table,
                    );
              const updated = await updateAiDetailPageProject(project.id, { brief });
              setProject(updated);
              setTableDataEdit(null);
              toast({
                title: tableDataEdit.kind === "spec" ? "参数表已保存" : "尺码表已保存",
              });
            } catch (e) {
              await alert({
                title: "保存失败",
                message: e instanceof Error ? e.message : "未知错误",
                variant: "error",
              });
            } finally {
              setTableDataEditSaving(false);
            }
          }}
        />
      ) : null}

      {promptEdit ? (
        <DetailPageSuiteSlotPromptEditDialog
          open
          onOpenChange={(open) => {
            if (!open) setPromptEdit(null);
          }}
          title={promptEdit.label}
          prompt={promptEdit.prompt}
          displayRatio={displayRatio}
          onSave={async (nextPrompt) => {
            const { moduleId, slotKey } = promptEdit;
            const modules = project.suite.modules.map((m) => {
              if (m.module_id !== moduleId) return m;
              return {
                ...m,
                slots: m.slots.map((s) =>
                  s.item_key === slotKey
                    ? { ...s, positive_prompt: nextPrompt, promptEdited: true }
                    : s,
                ),
              };
            });
            const updated = await updateAiDetailPageProject(project.id, {
              suite: { ...project.suite, modules },
            });
            setProject(updated);
            setPromptEdit(null);
          }}
          onRewrite={() => {
            void (async () => {
              const updated = await generateAiDetailPagePrompts(project.id, {
                moduleId: promptEdit.moduleId,
                slotKey: promptEdit.slotKey,
                modelKey: chatModelKey,
              });
              setProject(updated);
              const mod = updated.suite.modules.find((m) => m.module_id === promptEdit.moduleId);
              const slot = mod?.slots.find((s) => s.item_key === promptEdit.slotKey);
              if (slot) {
                setPromptEdit({
                  ...promptEdit,
                  prompt: slot.positive_prompt,
                });
              }
            })();
          }}
        />
      ) : null}
    </>
  );
}
