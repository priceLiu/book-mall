"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { History, Images, Package, Plus, Sparkles, Trash2 } from "lucide-react";

import { DetailPageSuiteAddSlotCard } from "@/components/detail-page-suite/detail-page-suite-add-slot-card";
import { DetailPageSuiteSlotCard } from "@/components/detail-page-suite/detail-page-suite-slot-card";
import {
  canAddCustomSuiteSlot,
  DETAIL_PAGE_SUITE_SIZE_MODULE_ID,
} from "@/lib/detail-page-suite-add-custom-slot";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomIconButton, EcomIconButtonLink } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import {
  detailPageRatioLabel,
  resolveDetailPageDisplayRatio,
  type EcomDetailPageRatio,
} from "@/lib/detail-page-suite-platform-ratio";
import {
  resolveModuleDisplaySlots,
  resolveReplicaModuleDisplaySlots,
} from "@/lib/detail-page-suite-module-slots";
import {
  countModuleSlotSelection,
  detailPageSuitePromptSelectionState,
  listDetailPageSuitePromptGenTargets,
  modulePromptSelectionState,
  resolveDetailPageSuiteBusyImageGenExcludeKeys,
  resolveDetailPageSuiteBusyPromptKeys,
  resolveDetailPageSuiteBusySlotKeys,
} from "@/lib/detail-page-suite-prompt-selection";
import { readDetailPageSuiteImageGenFailures } from "@/lib/detail-page-suite-image-failures";
import { formatEcomImageGenUserMessage } from "@/lib/ecom-image-gen-user-error";
import { isDetailPageSuiteSizeChartDataLabel } from "@/lib/detail-page-suite-size-chart";
import { composeSuiteSlotKey, isSuiteSlotSelectable } from "@/lib/detail-page-suite-slot-selection";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
} from "@/lib/detail-page-suite-types";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import {
  findEcomImagePreviewIndex,
  type EcomImagePreviewItem,
} from "@/lib/media/ecom-image-preview";
import { buildDetailPageSuiteProjectPreviewItems } from "@/lib/detail-page-suite-slot-images";
import { buildGenerationRecordsLibraryPath } from "@/lib/ecom-generation-record-api";
import { cn } from "@/lib/utils";

export type DetailPageSuiteSlotImagePreviewPayload = {
  src: string;
  title: string;
  items: EcomImagePreviewItem[];
  initialIndex: number;
};

type Props = {
  project: DetailPageSuiteProject;
  llmBusy?: boolean;
  uploading?: boolean;
  uploadProgress?: number | null;
  uploadProgressLabel?: string;
  activeGenSlotKeys?: ReadonlySet<string>;
  activePromptModuleIds?: ReadonlySet<string>;
  activePromptSlotKeys?: ReadonlySet<string>;
  activeRewriteSlotKeys?: ReadonlySet<string>;
  promptSelectionKeys?: ReadonlySet<string>;
  onTogglePromptSelection?: (key: string) => void;
  onToggleModulePromptSelection?: (moduleId: string, selected: boolean) => void;
  onToggleAllPromptSelection?: (selected: boolean) => void;
  onGenerateModulePrompts?: (moduleId: string) => void;
  onGenerateModuleImages?: (moduleId: string) => void;
  displayRatio?: EcomDetailPageRatio;
  /** 出图模型展示名（非「生成中」状态） */
  imageModelLabel?: string;
  onUploadFiles: (files: File[]) => void;
  onAttachAssets: (assets: Array<{ id: string; ossUrl: string; title: string }>) => void;
  onRemoveRef: (id: string) => void;
  onPreview: (url: string) => void;
  onPreviewSlotImage: (payload: DetailPageSuiteSlotImagePreviewPayload) => void;
  onOpenPromptEdit?: (
    moduleId: string,
    slotKey: string,
    prompt: string,
    label: string,
    slotCopy?: string,
  ) => void;
  hitIncludeSlotCopyOnImage?: boolean;
  onHitIncludeSlotCopyOnImageChange?: (value: boolean) => void;
  onToggleModule: (moduleId: string, enable: boolean) => void;
  onChangeCount: (moduleId: string, n: number) => void;
  onToggleItem: (moduleId: string, item: string) => void;
  onRequestAddItem: (moduleId: string) => void;
  onRequestAddSlot: (moduleId: string) => void;
  onPickImageModel: () => void;
  onDisplayRatioChange?: (ratio: EcomDetailPageRatio) => void;
  onActiveImageIndexChange?: (moduleId: string, slotKey: string, index: number) => void;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onDeleteProject?: () => void | Promise<void>;
  /** 详情页套图复刻 / 爆款：隐藏顶栏上传/卖点，下区出图格子 */
  variant?: "default" | "replica" | "hit";
  /** 复刻页顶栏由 Studio 固定在滚动区外时设为 true */
  hideHeader?: boolean;
};

export type DetailPageSuiteWorkbenchChromeProps = Pick<
  Props,
  | "project"
  | "variant"
  | "llmBusy"
  | "displayRatio"
  | "onDisplayRatioChange"
  | "imageModelLabel"
  | "onNewProject"
  | "loadProjectList"
  | "onOpenProject"
  | "onDeleteProject"
  | "onPickImageModel"
  | "onExportPack"
  | "exportPackBusy"
>;

/** 项目标题 + 工具条（复刻页固定顶栏 / 套图中栏 sticky） */
export function DetailPageSuiteWorkbenchChrome({
  project,
  variant = "default",
  llmBusy,
  displayRatio: displayRatioProp,
  onDisplayRatioChange,
  imageModelLabel,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onDeleteProject,
  onPickImageModel,
  onExportPack,
  exportPackBusy,
}: DetailPageSuiteWorkbenchChromeProps) {
  const isReplica = variant === "replica";
  const isHit = variant === "hit";
  const isWorkbench = isReplica || isHit;
  const phase = project.meta?.phase ?? "product_ref";
  const phaseLabel = useMemo(() => {
    const hit = (
      [
        { id: "product_ref", label: "产品图" },
        { id: "dimensions", label: "七维" },
        { id: "sellpoints", label: "卖点" },
        { id: "template", label: "模板" },
        { id: "modules", label: "模块" },
        { id: "subdims", label: "子维度" },
        { id: "prompts", label: "提示词" },
        { id: "images", label: "出图" },
        { id: "done", label: "完成" },
      ] as const
    ).find((s) => s.id === phase);
    return hit?.label ?? "产品图";
  }, [phase]);

  const enabledTotal = project.suite.modules
    .filter((m) => m.enable)
    .reduce((n, m) => n + m.generate_count, 0);

  const displayRatio = useMemo(
    () =>
      displayRatioProp ??
      resolveDetailPageDisplayRatio(
        project.brief?.platformCode,
        project.settings.imageRatio,
      ),
    [displayRatioProp, project.brief?.platformCode, project.settings.imageRatio],
  );

  const generationRecordsHref = useMemo(() => {
    if (!isWorkbench) return undefined;
    return buildGenerationRecordsLibraryPath({
      projectId: project.id,
      sourceModule: isHit
        ? "detail-page-suite-hit"
        : isReplica
          ? "detail-page-suite-replica"
          : undefined,
      returnTo: isHit
        ? "/ecom/detail-page-suite-hit"
        : isReplica
          ? "/ecom/detail-page-suite-replica"
          : undefined,
      projectTitle: project.title?.trim() || undefined,
    });
  }, [isHit, isReplica, isWorkbench, project.id, project.title]);

  return (
    <header className="shrink-0 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">
            {project.title?.trim() ||
              (isHit ? "爆款详情页套图" : isReplica ? "详情页套图复刻" : "详情页套图")}
          </h2>
          <p className="text-[11px] text-[#6e6e73]">
            阶段：{isWorkbench ? "出图" : phaseLabel}
            {!isWorkbench && project.brief?.platform ? ` · ${project.brief.platform}` : ""}
            {" · 已开模块 "}
            {enabledTotal}/{isWorkbench ? 49 : 44} 张
            {" · 展示比例 "}
            {onDisplayRatioChange ? (
              <select
                className="ml-0.5 rounded border border-[#d2d2d7] bg-white px-1 py-0 text-[11px]"
                value={displayRatio}
                onChange={(e) =>
                  onDisplayRatioChange(e.target.value as EcomDetailPageRatio)
                }
              >
                <option value="3:4">3:4</option>
                <option value="4:5">4:5</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
              </select>
            ) : (
              detailPageRatioLabel(displayRatio, project.brief?.platformCode)
            )}
            {imageModelLabel ? ` · 出图模型 ${imageModelLabel}` : ""}
          </p>
        </div>
        <EcomIconToolbar>
          <EcomIconToolbarGroup label="项目">
            {onNewProject ? (
              <EcomIconButton
                label="新建项目"
                icon={Plus}
                disabled={llmBusy}
                onClick={() => void onNewProject()}
              />
            ) : null}
            {loadProjectList && onOpenProject ? (
              <EcomProjectListButton
                currentProjectId={project.id}
                loadProjects={loadProjectList}
                onSelectProject={onOpenProject}
                title={
                  isHit
                    ? "爆款详情页套图 · 项目列表"
                    : isReplica
                      ? "详情页套图复刻 · 项目列表"
                      : "详情页套图 · 项目列表"
                }
                emptyHint={
                  isHit
                    ? "还没有保存过的爆款详情页套图项目。"
                    : isReplica
                      ? "还没有保存过的详情页套图复刻项目。"
                      : "还没有保存过的详情页套图项目。"
                }
                disabled={llmBusy}
              />
            ) : null}
            {onDeleteProject ? (
              <EcomIconButton
                label="删除项目"
                icon={Trash2}
                variant="destructive"
                disabled={llmBusy}
                onClick={() => void onDeleteProject()}
              />
            ) : null}
          </EcomIconToolbarGroup>
          <EcomIconToolbarGroup label="生图">
            <EcomIconButton
              label="选择生图模型与参数"
              icon={Sparkles}
              onClick={onPickImageModel}
            />
          </EcomIconToolbarGroup>
          {isWorkbench && onExportPack ? (
            <EcomIconToolbarGroup label="交付">
              <EcomIconButton
                label={exportPackBusy ? "打包中…" : "素材打包导出"}
                icon={Package}
                disabled={llmBusy || exportPackBusy}
                onClick={() => void onExportPack()}
              />
            </EcomIconToolbarGroup>
          ) : null}
          <EcomIconToolbarGroup label="资产">
            {isWorkbench && generationRecordsHref ? (
              <EcomIconButtonLink
                label="生成记录"
                icon={History}
                href={generationRecordsHref}
              />
            ) : null}
            <EcomIconButtonLink label="我的资产" icon={Images} href="/library" />
          </EcomIconToolbarGroup>
        </EcomIconToolbar>
      </div>
    </header>
  );
}

export function DetailPageSuiteContentPanel({
  project,
  llmBusy,
  uploading,
  uploadProgress,
  uploadProgressLabel,
  activeGenSlotKeys,
  activePromptModuleIds,
  activePromptSlotKeys,
  activeRewriteSlotKeys,
  promptSelectionKeys,
  onTogglePromptSelection,
  onToggleModulePromptSelection,
  onToggleAllPromptSelection,
  onGenerateModulePrompts,
  onGenerateModuleImages,
  displayRatio: displayRatioProp,
  onUploadFiles,
  onAttachAssets,
  onRemoveRef,
  onPreview,
  onPreviewSlotImage,
  onOpenPromptEdit,
  onToggleModule,
  onChangeCount,
  onToggleItem,
  onRequestAddItem,
  onRequestAddSlot,
  onPickImageModel,
  onDisplayRatioChange,
  onActiveImageIndexChange,
  imageModelLabel,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onDeleteProject,
  variant = "default",
  hideHeader = false,
  hitIncludeSlotCopyOnImage = false,
  onHitIncludeSlotCopyOnImageChange,
}: Props) {
  const isHit = variant === "hit";
  const isWorkbench = variant === "replica" || isHit;
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const activeGen = activeGenSlotKeys ?? new Set<string>();
  const imageGenBusyKeys = useMemo(
    () => resolveDetailPageSuiteBusyImageGenExcludeKeys(project, activeGen),
    [project, activeGen],
  );
  const activePromptModules = activePromptModuleIds ?? new Set<string>();
  const activePromptSlots = activePromptSlotKeys ?? new Set<string>();
  const activeRewrite = activeRewriteSlotKeys ?? new Set<string>();
  const promptSelection = promptSelectionKeys ?? new Set<string>();
  const phase = project.meta?.phase ?? "product_ref";
  /** 子维度 / 提示词 / 出图阶段均可在中栏勾选并批量生成提示词 */
  const promptWorkspacePhase =
    isWorkbench || phase === "subdims" || phase === "prompts" || phase === "images";
  const promptTargets = useMemo(
    () => listDetailPageSuitePromptGenTargets(project),
    [project],
  );
  const busyPromptKeys = useMemo(
    () => resolveDetailPageSuiteBusyPromptKeys(project, activePromptModules, activePromptSlots),
    [project, activePromptModules, activePromptSlots],
  );
  const busySlotKeys = useMemo(() => {
    const busy = resolveDetailPageSuiteBusySlotKeys(
      project,
      activePromptModules,
      activePromptSlots,
      activeGen,
      activeRewrite,
    );
    for (const key of resolveDetailPageSuiteBusyImageGenExcludeKeys(project, activeGen)) {
      busy.add(key);
    }
    return busy;
  }, [project, activePromptModules, activePromptSlots, activeGen, activeRewrite]);
  const promptSelectionState = detailPageSuitePromptSelectionState(
    promptTargets,
    promptSelection,
    { excludeKeys: busySlotKeys },
  );
  const promptReadyCount = promptTargets.filter((t) => t.hasPrompt).length;

  const displayRatio = useMemo(
    () =>
      displayRatioProp ??
      resolveDetailPageDisplayRatio(
        project.brief?.platformCode,
        project.settings.imageRatio,
      ),
    [displayRatioProp, project.brief?.platformCode, project.settings.imageRatio],
  );

  const projectPreviewItems = useMemo(
    () =>
      buildDetailPageSuiteProjectPreviewItems(project, {
        replicaMode: variant === "replica",
        includeDisabledModules: isWorkbench,
      }),
    [project, variant, isWorkbench],
  );

  const handlePreviewSlotImage = useCallback(
    (payload: DetailPageSuiteSlotImagePreviewPayload) => {
      if (projectPreviewItems.length <= 1) {
        onPreviewSlotImage(payload);
        return;
      }
      const idx = findEcomImagePreviewIndex(projectPreviewItems, payload.src);
      onPreviewSlotImage({
        ...payload,
        items: projectPreviewItems,
        initialIndex: idx >= 0 ? idx : payload.initialIndex,
      });
    },
    [onPreviewSlotImage, projectPreviewItems],
  );

  const genStatusLabel = useMemo(() => {
    if (imageGenBusyKeys.size > 0) {
      const labels = [...imageGenBusyKeys].slice(0, 4).map((k) => k.split("::")[1] ?? k);
      const suffix = imageGenBusyKeys.size > 4 ? ` 等 ${imageGenBusyKeys.size} 张` : "";
      return `${labels.join("、")}${suffix} 出图中`;
    }
    if (activePromptSlots.size > 0) {
      return `${activePromptSlots.size} 条提示词生成中`;
    }
    if (activePromptModules.size > 0) {
      return `${activePromptModules.size} 个模块提示词生成中`;
    }
    if (activeRewrite.size > 0) {
      return `${activeRewrite.size} 条提示词重写中`;
    }
    return null;
  }, [imageGenBusyKeys, activePromptModules, activePromptSlots, activeRewrite]);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col bg-white",
        isWorkbench ? "min-h-0" : "h-full min-h-0 overflow-hidden",
      )}
    >
      <div
        className={cn(
          "w-full",
          isWorkbench
            ? "[overflow-anchor:none]"
            : "ecom-scrollbar-overlay h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]",
        )}
      >
        {!hideHeader ? (
          <div className={cn(!isWorkbench && "sticky top-0 z-20")}>
            <DetailPageSuiteWorkbenchChrome
              project={project}
              variant={variant}
              llmBusy={llmBusy}
              displayRatio={displayRatioProp}
              onDisplayRatioChange={onDisplayRatioChange}
              imageModelLabel={imageModelLabel}
              onNewProject={onNewProject}
              loadProjectList={loadProjectList}
              onOpenProject={onOpenProject}
              onDeleteProject={onDeleteProject}
              onPickImageModel={onPickImageModel}
            />
          </div>
        ) : null}

        <div className="px-5 py-4">
          {genStatusLabel && !isHit ? (
            <StoryboardTaskStatus
              active
              sweep
              title={genStatusLabel}
              detail="其它点位可并行提交；长耗时任务可在右下角 Dock 查看。"
              className="mb-4"
            />
          ) : null}

          {!isWorkbench ? (
          <section className="mb-6">
            <EcomRefUploadCard
              title="产品图"
              items={project.references.map((r) => ({
                id: r.id,
                ossUrl: r.ossUrl,
                label: r.label,
                kind: "image" as const,
              }))}
              emptyHint="可上传多张产品图，用于识图卖点与出图参考"
              multiple
              busy={llmBusy || uploading}
              showUploadProgress={uploading}
              uploadProgress={uploadProgress}
              uploadProgressLabel={uploadProgressLabel}
              onUploadFiles={onUploadFiles}
              onOpenFilePicker={() => inputRef.current?.click()}
              onOpenAssetPicker={() => setAssetOpen(true)}
              onRemove={onRemoveRef}
              onPreviewItem={(item) => onPreview(item.ossUrl)}
            />
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) onUploadFiles(files);
                e.target.value = "";
              }}
            />
            <EcomAssetPickerDialog
              open={assetOpen}
              onOpenChange={setAssetOpen}
              maxSelect={12}
              defaultModule="detail-page-suite"
              onConfirm={(assets) => {
                setAssetOpen(false);
                onAttachAssets(assets);
              }}
            />
          </section>
          ) : null}

          {!isWorkbench && project.brief?.sellPoints?.length ? (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold">卖点清单</h2>
              <ul className="list-disc pl-5 text-sm text-[#424245]">
                {project.brief.sellPoints.map((s) => (
                  <li key={s.id}>{s.text}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {isWorkbench || project.suite.modules.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">模块 · 提示词 · 出图</h2>
                {promptWorkspacePhase && onToggleAllPromptSelection ? (
                  <label className="flex items-center gap-1 text-xs text-[#6e6e73]">
                    <input
                      type="checkbox"
                      checked={promptSelectionState === "all"}
                      ref={(el) => {
                        if (el) el.indeterminate = promptSelectionState === "partial";
                      }}
                      onChange={() =>
                        onToggleAllPromptSelection(promptSelectionState !== "all")
                      }
                    />
                    全选点位（{promptTargets.length}）
                  </label>
                ) : null}
              </div>
              {promptWorkspacePhase ? (
                <p className="text-[11px] leading-relaxed text-[#86868b]">
                  勾选点位后，在模块右侧「生成提示词」或「生图」；格子内勾选、点击编辑「文案与出图」、已出图 hover
                  操作。多条可并行提交。提示词 {promptReadyCount}/{promptTargets.length}。
                </p>
              ) : null}
              {isHit && onHitIncludeSlotCopyOnImageChange ? (
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2 text-xs text-[#424245]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={hitIncludeSlotCopyOnImage}
                    onChange={(e) => onHitIncludeSlotCopyOnImageChange(e.target.checked)}
                  />
                  <span>
                    出图时将各点位「模块文案」一并渲染进画面（默认仅出图不含字；无文案的点位仍只按提示词出图）
                  </span>
                </label>
              ) : null}
              {project.suite.modules.map((mod) => (
                <ModuleBlock
                  key={mod.module_id}
                  mod={mod}
                  displayRatio={displayRatio}
                  promptWorkspacePhase={promptWorkspacePhase}
                  activeGen={imageGenBusyKeys}
                  activePromptModules={activePromptModules}
                  activePromptSlots={activePromptSlots}
                  activeRewrite={activeRewrite}
                  busyPromptKeys={busyPromptKeys}
                  busySlotKeys={busySlotKeys}
                  promptSelection={promptSelection}
                  onTogglePromptSelection={onTogglePromptSelection}
                  onToggleModulePromptSelection={onToggleModulePromptSelection}
                  onPreview={onPreview}
                  onPreviewSlotImage={handlePreviewSlotImage}
                  onOpenPromptEdit={onOpenPromptEdit}
                  onToggleModule={onToggleModule}
                  onChangeCount={onChangeCount}
                  onToggleItem={onToggleItem}
                  onRequestAddItem={onRequestAddItem}
                  onRequestAddSlot={onRequestAddSlot}
                  suite={project.suite}
                  onGenerateModulePrompts={onGenerateModulePrompts}
                  onGenerateModuleImages={onGenerateModuleImages}
                  onActiveImageIndexChange={onActiveImageIndexChange}
                  imageGenFailures={readDetailPageSuiteImageGenFailures(project.meta)}
                  replicaMode={isWorkbench}
                  isHit={isHit}
                />
              ))}
            </section>
          ) : (
            <p className="text-sm text-[#86868b]">右侧选择平台与模板后，这里会列出大模块。</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleBlock({
  mod,
  displayRatio,
  promptWorkspacePhase,
  activeGen,
  activePromptModules,
  activePromptSlots,
  activeRewrite,
  busyPromptKeys,
  busySlotKeys,
  promptSelection,
  onTogglePromptSelection,
  onToggleModulePromptSelection,
  onGenerateModulePrompts,
  onGenerateModuleImages,
  onPreview,
  onPreviewSlotImage,
  onOpenPromptEdit,
  onToggleModule,
  onChangeCount,
  onToggleItem,
  onRequestAddItem,
  onRequestAddSlot,
  onActiveImageIndexChange,
  imageGenFailures,
  suite,
  replicaMode,
  isHit = false,
}: {
  replicaMode?: boolean;
  isHit?: boolean;
  mod: DetailPageSuiteModuleState;
  suite: DetailPageSuiteProject["suite"];
  displayRatio: EcomDetailPageRatio;
  promptWorkspacePhase: boolean;
  activeGen: ReadonlySet<string>;
  activePromptModules: ReadonlySet<string>;
  activePromptSlots: ReadonlySet<string>;
  activeRewrite: ReadonlySet<string>;
  busyPromptKeys: ReadonlySet<string>;
  busySlotKeys: ReadonlySet<string>;
  promptSelection: ReadonlySet<string>;
  onTogglePromptSelection?: (key: string) => void;
  onToggleModulePromptSelection?: (moduleId: string, selected: boolean) => void;
  onGenerateModulePrompts?: (moduleId: string) => void;
  onGenerateModuleImages?: (moduleId: string) => void;
  onPreview: (url: string) => void;
  onPreviewSlotImage: (payload: DetailPageSuiteSlotImagePreviewPayload) => void;
  onOpenPromptEdit?: Props["onOpenPromptEdit"];
  onToggleModule: Props["onToggleModule"];
  onChangeCount: Props["onChangeCount"];
  onToggleItem: Props["onToggleItem"];
  onRequestAddItem: Props["onRequestAddItem"];
  onRequestAddSlot: Props["onRequestAddSlot"];
  onActiveImageIndexChange?: Props["onActiveImageIndexChange"];
  imageGenFailures: ReturnType<typeof readDetailPageSuiteImageGenFailures>;
}) {
  const gridSlots = useMemo(
    () =>
      replicaMode ? resolveReplicaModuleDisplaySlots(mod) : resolveModuleDisplaySlots(mod),
    [mod, replicaMode],
  );
  const showReplicaSlotGrid = replicaMode;
  const modulePickState = modulePromptSelectionState(mod, promptSelection, {
    excludeKeys: busySlotKeys,
  });
  const selectedSlotCount = countModuleSlotSelection(mod, promptSelection, {
    excludeKeys: busySlotKeys,
  });
  const selectedImageGenCount = countModuleSlotSelection(mod, promptSelection, {
    excludeKeys: busySlotKeys,
    requirePrompt: true,
  });
  const promptReadyCount = gridSlots.filter((s) => s.positive_prompt?.trim()).length;
  const modulePromptBusy = activePromptModules.has(mod.module_id);
  const addSlotCheck = canAddCustomSuiteSlot(suite, mod.module_id);
  const canAddSlot = addSlotCheck.ok;
  const isSizeChartModule = mod.module_id === DETAIL_PAGE_SUITE_SIZE_MODULE_ID;

  return (
    <div className="rounded-xl border border-[#e8e8ed] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm font-medium">
          <input
            type="checkbox"
            checked={mod.enable}
            disabled={replicaMode}
            onChange={(e) => onToggleModule(mod.module_id, e.target.checked)}
          />
          {mod.module_name}
        </label>
        {promptWorkspacePhase &&
        (replicaMode || mod.enable) &&
        gridSlots.length > 0 &&
        onToggleModulePromptSelection ? (
          <label className="flex items-center gap-1 text-xs text-[#6e6e73]">
            <input
              type="checkbox"
              checked={modulePickState === "all"}
              ref={(el) => {
                if (el) el.indeterminate = modulePickState === "partial";
              }}
              onChange={() =>
                onToggleModulePromptSelection(
                  mod.module_id,
                  modulePickState !== "all",
                )
              }
            />
            全选
          </label>
        ) : null}
        {!replicaMode ? (
        <label className="text-xs text-[#86868b]">
          N
          <input
            type="number"
            min={0}
            max={mod.max_num}
            className="ml-1 w-14 rounded border border-[#d2d2d7] px-1 py-0.5"
            value={mod.generate_count}
            onChange={(e) => onChangeCount(mod.module_id, Number(e.target.value) || 0)}
          />
          / {mod.max_num}
        </label>
        ) : null}
        {promptWorkspacePhase && onGenerateModulePrompts && !isSizeChartModule && !replicaMode ? (
          <EcomButtonSecondary
            size="sm"
            disabled={!mod.enable || selectedSlotCount === 0}
            onClick={() => onGenerateModulePrompts(mod.module_id)}
          >
            {`生成提示词（${selectedSlotCount}）`}
          </EcomButtonSecondary>
        ) : null}
        {promptWorkspacePhase && onGenerateModuleImages ? (
          <EcomButtonPrimary
            size="sm"
            disabled={(!replicaMode && !mod.enable) || selectedImageGenCount === 0}
            onClick={() => onGenerateModuleImages(mod.module_id)}
          >
            {`生图（${selectedImageGenCount}）`}
          </EcomButtonPrimary>
        ) : null}
      </div>

      {(replicaMode || mod.enable) && gridSlots.length > 0 ? (
        <p className="mb-3 text-[11px] text-[#86868b]">
          已选 {selectedSlotCount}/{gridSlots.length} 个点位
          {isSizeChartModule ? (
            " · 尺码表编辑后勾选生图；线稿/对比图需先有提示词"
          ) : (
            <>
              {" "}
              · 提示词 {promptReadyCount}/{gridSlots.length}
              {selectedSlotCount > 0 && promptReadyCount < gridSlots.length
                ? " · 出图时将跳过无提示词的勾选点位"
                : ""}
            </>
          )}
        </p>
      ) : null}

      {showReplicaSlotGrid || (mod.enable && gridSlots.length > 0) ? (
        <div className="mb-3 flex flex-wrap gap-4">
          {gridSlots.map((slot) => {
            const slotComposite = composeSuiteSlotKey(mod.module_id, slot.item_key);
            const hasPrompt = isSuiteSlotSelectable(slot);
            const slotGenBusy = activeGen.has(slotComposite);
            const slotPromptBusy =
              activePromptSlots.has(slotComposite) || modulePromptBusy;
            const slotRewriteBusy = activeRewrite.has(slotComposite);
            const slotBusy = slotGenBusy || slotPromptBusy || slotRewriteBusy;
            const busyLabel = slotGenBusy
              ? isDetailPageSuiteSizeChartDataLabel(slot.item_label)
                ? "生成尺码表…"
                : undefined
              : slotRewriteBusy
                ? "重写提示词…"
                : slotPromptBusy
                  ? isDetailPageSuiteSizeChartDataLabel(slot.item_label)
                    ? "准备尺码表…"
                    : "撰写提示词…"
                  : undefined;
            return (
              <DetailPageSuiteSlotCard
                key={`${mod.module_id}-${slot.item_key}-${slot.item_label}`}
                slot={slot}
                moduleId={mod.module_id}
                displayRatio={displayRatio}
                selectable={promptWorkspacePhase && !slotBusy}
                selected={
                  promptSelection.has(slotComposite) && !busySlotKeys.has(slotComposite)
                }
                onToggleSelect={
                  promptWorkspacePhase && onTogglePromptSelection && !slotBusy
                    ? () => onTogglePromptSelection(slotComposite)
                    : undefined
                }
                busy={slotBusy}
                busyLabel={busyLabel}
                onPreviewImage={onPreviewSlotImage}
                onOpenPromptEdit={
                  onOpenPromptEdit && (hasPrompt || isHit) && !slotBusy
                    ? () =>
                        onOpenPromptEdit(
                          mod.module_id,
                          slot.item_key,
                          slot.positive_prompt,
                          slot.item_label,
                          slot.slot_copy,
                        )
                    : undefined
                }
                slotCopyMode={isHit ? "hit" : undefined}
                onActiveImageIndexChange={
                  onActiveImageIndexChange
                    ? (index) => onActiveImageIndexChange(mod.module_id, slot.item_key, index)
                    : undefined
                }
                imageGenError={
                  imageGenFailures[slotComposite]?.message
                    ? formatEcomImageGenUserMessage(imageGenFailures[slotComposite]!.message)
                    : undefined
                }
              />
            );
          })}
          <DetailPageSuiteAddSlotCard
            displayRatio={displayRatio}
            disabled={!canAddSlot || modulePromptBusy}
            disabledReason={!canAddSlot && !addSlotCheck.ok ? addSlotCheck.reason : undefined}
            hint={
              mod.module_id === "mod7_size_table"
                ? "点击新增默认尺码表"
                : "点击输入提示词"
            }
            onClick={() => onRequestAddSlot(mod.module_id)}
          />
        </div>
      ) : mod.enable && !replicaMode ? (
        <p className="mb-2 text-xs text-[#86868b]">请在下方配置子维度，或调整 N 张数。</p>
      ) : null}

      {mod.enable && !replicaMode ? (
        <details className="group/subdim mt-1 rounded-lg border border-[#f0f0f2] bg-[#fafafa] px-3 py-2">
          <summary className="cursor-pointer select-none text-[11px] font-medium text-[#6e6e73] marker:content-none">
            <span className="group-open/subdim:hidden">配置子维度（{mod.selected_item_list.length}/{mod.generate_count}）</span>
            <span className="hidden group-open/subdim:inline">收起子维度配置</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {mod.candidate_pool.map((item) => {
              const on = mod.selected_item_list.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    on
                      ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                      : "border-[#d2d2d7] text-[#6e6e73]",
                  )}
                  onClick={() => onToggleItem(mod.module_id, item)}
                >
                  {item}
                </button>
              );
            })}
            <button
              type="button"
              className="rounded-full border border-dashed border-[#d2d2d7] px-2 py-0.5 text-[11px]"
              onClick={() => onRequestAddItem(mod.module_id)}
            >
              + 子维度
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
