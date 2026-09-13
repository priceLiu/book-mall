"use client";

import { useMemo, useRef, useState } from "react";
import { Images, Plus, Sparkles, Trash2 } from "lucide-react";

import { DetailPageSuiteAddSlotCard } from "@/components/detail-page-suite/detail-page-suite-add-slot-card";
import { DetailPageSuiteSlotCard } from "@/components/detail-page-suite/detail-page-suite-slot-card";
import { canAddCustomSuiteSlot } from "@/lib/detail-page-suite-add-custom-slot";
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
import { resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import {
  composeSuiteSlotKey,
  isSuiteSlotSelectable,
  suiteModuleImageSelectionState,
  suiteModuleSelectableSlots,
} from "@/lib/detail-page-suite-slot-selection";
import type {
  DetailPageSuiteModuleState,
  DetailPageSuiteProject,
} from "@/lib/detail-page-suite-types";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import type { EcomImagePreviewItem } from "@/lib/media/ecom-image-preview";
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
  activeRewriteSlotKeys?: ReadonlySet<string>;
  displayRatio?: EcomDetailPageRatio;
  /** 出图模型展示名（非「生成中」状态） */
  imageModelLabel?: string;
  onUploadFiles: (files: File[]) => void;
  onAttachAssets: (assets: Array<{ id: string; ossUrl: string; title: string }>) => void;
  onRemoveRef: (id: string) => void;
  onPreview: (url: string) => void;
  onPreviewSlotImage: (payload: DetailPageSuiteSlotImagePreviewPayload) => void;
  onOpenPromptEdit?: (moduleId: string, slotKey: string, prompt: string, label: string) => void;
  onToggleModule: (moduleId: string, enable: boolean) => void;
  onChangeCount: (moduleId: string, n: number) => void;
  onToggleItem: (moduleId: string, item: string) => void;
  onRequestAddItem: (moduleId: string) => void;
  onRequestAddSlot: (moduleId: string) => void;
  onGenModulePrompts: (moduleId: string) => void;
  onToggleModuleImageSelect: (moduleId: string, selected: boolean) => void;
  onToggleSlotImageSelect: (moduleId: string, slotKey: string) => void;
  onRequestGenerateModule: (moduleId: string, slotKeys?: string[]) => void;
  onRequestGenerateSlot: (moduleId: string, slotKey: string) => void;
  onRewriteSlot: (moduleId: string, slotKey: string) => void;
  onPickImageModel: () => void;
  onDisplayRatioChange?: (ratio: EcomDetailPageRatio) => void;
  onActiveImageIndexChange?: (moduleId: string, slotKey: string, index: number) => void;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onDeleteProject?: () => void | Promise<void>;
};

export function DetailPageSuiteContentPanel({
  project,
  llmBusy,
  uploading,
  uploadProgress,
  uploadProgressLabel,
  activeGenSlotKeys,
  activePromptModuleIds,
  activeRewriteSlotKeys,
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
  onGenModulePrompts,
  onToggleModuleImageSelect,
  onToggleSlotImageSelect,
  onRequestGenerateModule,
  onRequestGenerateSlot,
  onRewriteSlot,
  onPickImageModel,
  onDisplayRatioChange,
  onActiveImageIndexChange,
  imageModelLabel,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onDeleteProject,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const activeGen = activeGenSlotKeys ?? new Set<string>();
  const activePromptModules = activePromptModuleIds ?? new Set<string>();
  const activeRewrite = activeRewriteSlotKeys ?? new Set<string>();

  const displayRatio = useMemo(
    () =>
      displayRatioProp ??
      resolveDetailPageDisplayRatio(
        project.brief?.platformCode,
        project.settings.imageRatio,
      ),
    [displayRatioProp, project.brief?.platformCode, project.settings.imageRatio],
  );

  const enabledTotal = project.suite.modules
    .filter((m) => m.enable)
    .reduce((n, m) => n + m.generate_count, 0);

  const phaseLabel = useMemo(() => {
    const phase = project.meta?.phase ?? "product_ref";
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
  }, [project.meta?.phase]);

  const genStatusLabel = useMemo(() => {
    if (activeGen.size > 0) {
      const labels = [...activeGen].slice(0, 4).map((k) => k.split("::")[1] ?? k);
      const suffix = activeGen.size > 4 ? ` 等 ${activeGen.size} 张` : "";
      return `${labels.join("、")}${suffix} 出图中`;
    }
    if (activePromptModules.size > 0) {
      return `${activePromptModules.size} 个模块提示词生成中`;
    }
    return null;
  }, [activeGen, activePromptModules]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      <div className="ecom-scrollbar-overlay h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
        <header className="sticky top-0 z-20 border-b border-[#e8e8ed] bg-white px-5 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">
                {project.title?.trim() || "详情页套图"}
              </h2>
              <p className="text-[11px] text-[#6e6e73]">
                阶段：{phaseLabel}
                {project.brief?.platform ? ` · ${project.brief.platform}` : ""}
                {" · 已开模块 "}
                {enabledTotal}/44 张
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
                    title="详情页套图 · 项目列表"
                    emptyHint="还没有保存过的详情页套图项目。"
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
              <EcomIconToolbarGroup label="资产">
                <EcomIconButtonLink label="我的资产" icon={Images} href="/library" />
              </EcomIconToolbarGroup>
            </EcomIconToolbar>
          </div>
        </header>

        <div className="px-5 py-4">
          {genStatusLabel ? (
            <StoryboardTaskStatus
              active
              sweep
              title={genStatusLabel}
              detail="其它点位可并行提交；长耗时任务可在右下角 Dock 查看。"
              className="mb-4"
            />
          ) : null}

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

          {project.brief?.sellPoints?.length ? (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold">卖点清单</h2>
              <ul className="list-disc pl-5 text-sm text-[#424245]">
                {project.brief.sellPoints.map((s) => (
                  <li key={s.id}>{s.text}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {project.suite.modules.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold">模块与出图</h2>
              {project.suite.modules.map((mod) => (
                <ModuleBlock
                  key={mod.module_id}
                  mod={mod}
                  displayRatio={displayRatio}
                  activeGen={activeGen}
                  activePromptModules={activePromptModules}
                  activeRewrite={activeRewrite}
                  onPreview={onPreview}
                  onPreviewSlotImage={onPreviewSlotImage}
                  onOpenPromptEdit={onOpenPromptEdit}
                  onToggleModule={onToggleModule}
                  onChangeCount={onChangeCount}
                  onToggleItem={onToggleItem}
                  onRequestAddItem={onRequestAddItem}
                  onRequestAddSlot={onRequestAddSlot}
                  suite={project.suite}
                  onGenModulePrompts={onGenModulePrompts}
                  onToggleModuleImageSelect={onToggleModuleImageSelect}
                  onToggleSlotImageSelect={onToggleSlotImageSelect}
                  onRequestGenerateModule={onRequestGenerateModule}
                  onRequestGenerateSlot={onRequestGenerateSlot}
                  onRewriteSlot={onRewriteSlot}
                  onActiveImageIndexChange={onActiveImageIndexChange}
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
  activeGen,
  activePromptModules,
  activeRewrite,
  onPreview,
  onPreviewSlotImage,
  onOpenPromptEdit,
  onToggleModule,
  onChangeCount,
  onToggleItem,
  onRequestAddItem,
  onRequestAddSlot,
  onGenModulePrompts,
  onToggleModuleImageSelect,
  onToggleSlotImageSelect,
  onRequestGenerateModule,
  onRequestGenerateSlot,
  onRewriteSlot,
  onActiveImageIndexChange,
  suite,
}: {
  mod: DetailPageSuiteModuleState;
  suite: DetailPageSuiteProject["suite"];
  displayRatio: EcomDetailPageRatio;
  activeGen: ReadonlySet<string>;
  activePromptModules: ReadonlySet<string>;
  activeRewrite: ReadonlySet<string>;
  onPreview: (url: string) => void;
  onPreviewSlotImage: (payload: DetailPageSuiteSlotImagePreviewPayload) => void;
  onOpenPromptEdit?: (moduleId: string, slotKey: string, prompt: string, label: string) => void;
  onToggleModule: Props["onToggleModule"];
  onChangeCount: Props["onChangeCount"];
  onToggleItem: Props["onToggleItem"];
  onRequestAddItem: Props["onRequestAddItem"];
  onRequestAddSlot: Props["onRequestAddSlot"];
  onGenModulePrompts: Props["onGenModulePrompts"];
  onToggleModuleImageSelect: Props["onToggleModuleImageSelect"];
  onToggleSlotImageSelect: Props["onToggleSlotImageSelect"];
  onRequestGenerateModule: Props["onRequestGenerateModule"];
  onRequestGenerateSlot: Props["onRequestGenerateSlot"];
  onRewriteSlot: Props["onRewriteSlot"];
  onActiveImageIndexChange?: Props["onActiveImageIndexChange"];
}) {
  const displaySlots = useMemo(() => resolveModuleDisplaySlots(mod), [mod]);
  const selectionState = suiteModuleImageSelectionState(mod);
  const selectableSlots = suiteModuleSelectableSlots(mod);
  const selectedKeys = selectableSlots
    .filter((s) => s.selectedForImage !== false)
    .map((s) => composeSuiteSlotKey(mod.module_id, s.item_key));
  const moduleGenKeys = selectedKeys.filter((k) => activeGen.has(k));
  const moduleGenBusy = moduleGenKeys.length > 0;
  const pendingKeys = selectedKeys.filter((k) => !activeGen.has(k));
  const promptReadyCount = displaySlots.filter((s) => s.positive_prompt?.trim()).length;
  const modulePromptBusy = activePromptModules.has(mod.module_id);
  const addSlotCheck = canAddCustomSuiteSlot(suite, mod.module_id);
  const canAddSlot = addSlotCheck.ok;

  return (
    <div className="rounded-xl border border-[#e8e8ed] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm font-medium">
          <input
            type="checkbox"
            checked={mod.enable}
            onChange={(e) => onToggleModule(mod.module_id, e.target.checked)}
          />
          {mod.module_name}
        </label>
        {selectableSlots.length > 0 ? (
          <label className="flex items-center gap-1 text-xs text-[#6e6e73]">
            <input
              type="checkbox"
              checked={selectionState === "all"}
              ref={(el) => {
                if (el) el.indeterminate = selectionState === "partial";
              }}
              onChange={(e) =>
                onToggleModuleImageSelect(mod.module_id, e.target.checked)
              }
            />
            全选出图
          </label>
        ) : null}
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
        <EcomButtonSecondary
          size="sm"
          disabled={modulePromptBusy || !mod.enable}
          onClick={() => onGenModulePrompts(mod.module_id)}
        >
          {modulePromptBusy ? "提示词生成中…" : "生成本模块提示词"}
        </EcomButtonSecondary>
        <EcomButtonPrimary
          size="sm"
          disabled={!mod.enable || (pendingKeys.length === 0 && !moduleGenBusy)}
          onClick={() =>
            onRequestGenerateModule(
              mod.module_id,
              pendingKeys.length > 0 ? pendingKeys : undefined,
            )
          }
        >
          {moduleGenBusy
            ? `出图中（${moduleGenKeys.length}）`
            : pendingKeys.length > 0
              ? `生成已选（${pendingKeys.length}）`
              : "生成已选"}
        </EcomButtonPrimary>
      </div>

      {mod.enable && displaySlots.length > 0 ? (
        <p className="mb-3 text-[11px] text-[#86868b]">
          已选 {displaySlots.length} 个点位 · 提示词 {promptReadyCount}/{displaySlots.length}
          {promptReadyCount < displaySlots.length ? " · 请先生成提示词再出图" : ""}
        </p>
      ) : null}

      {mod.enable && displaySlots.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-4">
          {displaySlots.map((slot) => {
            const slotComposite = composeSuiteSlotKey(mod.module_id, slot.item_key);
            const hasPrompt = isSuiteSlotSelectable(slot);
            const slotGenBusy = activeGen.has(slotComposite);
            const slotRewriteBusy = activeRewrite.has(slotComposite);
            const slotBusy = slotGenBusy || slotRewriteBusy || modulePromptBusy;
            const busyLabel = slotGenBusy
              ? "出图中…"
              : slotRewriteBusy
                ? "重写提示词…"
                : modulePromptBusy
                  ? "撰写提示词…"
                  : undefined;
            return (
              <DetailPageSuiteSlotCard
                key={`${mod.module_id}-${slot.item_key}-${slot.item_label}`}
                slot={slot}
                moduleId={mod.module_id}
                displayRatio={displayRatio}
                selectable
                selected={hasPrompt && slot.selectedForImage !== false}
                onToggleSelect={
                  hasPrompt && !slotBusy
                    ? () => onToggleSlotImageSelect(mod.module_id, slot.item_key)
                    : undefined
                }
                busy={slotBusy}
                busyLabel={busyLabel}
                onRegenerateImage={
                  hasPrompt && !slotBusy
                    ? () => onRequestGenerateSlot(mod.module_id, slot.item_key)
                    : undefined
                }
                onPreviewImage={onPreviewSlotImage}
                onOpenPromptEdit={
                  onOpenPromptEdit && hasPrompt && !slotBusy
                    ? () =>
                        onOpenPromptEdit(
                          mod.module_id,
                          slot.item_key,
                          slot.positive_prompt,
                          slot.item_label,
                        )
                    : undefined
                }
                onRewritePrompt={
                  hasPrompt && !slotBusy
                    ? () => onRewriteSlot(mod.module_id, slot.item_key)
                    : undefined
                }
                onActiveImageIndexChange={
                  onActiveImageIndexChange
                    ? (index) => onActiveImageIndexChange(mod.module_id, slot.item_key, index)
                    : undefined
                }
              />
            );
          })}
          <DetailPageSuiteAddSlotCard
            displayRatio={displayRatio}
            disabled={!canAddSlot || modulePromptBusy}
            disabledReason={!canAddSlot && !addSlotCheck.ok ? addSlotCheck.reason : undefined}
            onClick={() => onRequestAddSlot(mod.module_id)}
          />
        </div>
      ) : mod.enable ? (
        <p className="mb-2 text-xs text-[#86868b]">请在下方配置子维度，或调整 N 张数。</p>
      ) : null}

      {mod.enable ? (
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
