"use client";

import { useRouter } from "next/navigation";
import { Download, Film, HelpCircle, Plus, RefreshCw, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { ProductImageSetRefUploader } from "@/components/product-image-set/product-image-set-ref-uploader";
import { ProductImageSetSlotWorkspace } from "@/components/product-image-set/product-image-set-slot-workspace";
import { ProductDesignSaveDialog } from "@/components/product-design/product-design-save-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomIconButton, EcomShareIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import {
  downloadProductImageSetExportZip,
  saveProductImageSetWorkflow,
} from "@/lib/ecom-product-image-set-api";
import { writeEcomLastProjectId } from "@/lib/ecom-last-project";
import type { EcomProjectListItem } from "@/lib/ecom-project-list-types";
import { createStoryboardFromAssets } from "@/lib/ecom-product-design-api";
import {
  productImageSetGenerateBusyDetail,
  productImageSetPlanBusyDetail,
} from "@/lib/product-image-set-busy";
import type {
  ProductImageSetProject,
  ProductImageSetSlot,
} from "@/lib/product-image-set-types";
import { totalStructureCount } from "@/lib/product-image-set-types";

const STORYBOARD_PROJECT_STORAGE_KEY = "ecom-storyboard-active-project";

type Props = {
  project: ProductImageSetProject;
  ratio: string;
  refBusy?: boolean;
  planning?: boolean;
  generating?: boolean;
  workspaceDisabled?: boolean;
  generatingSlotIds: Set<string>;
  onUpload: (file: File) => Promise<void>;
  onRemoveRef: (refId: string) => void;
  onProjectChange: () => void | Promise<void>;
  onSaveSlots: (slots: ProductImageSetSlot[]) => Promise<void>;
  onGenerateSlots: (slotIds: string[]) => void | Promise<void>;
  onNewProject?: () => void | Promise<void>;
  loadProjectList?: () => Promise<EcomProjectListItem[]>;
  onOpenProject?: (id: string) => void | Promise<void>;
  onReplan?: () => void | Promise<void>;
  onShareWorkflow?: () => void;
};

export function ProductImageSetContentPanel({
  project,
  ratio,
  refBusy,
  planning,
  generating,
  workspaceDisabled,
  generatingSlotIds,
  onUpload,
  onRemoveRef,
  onProjectChange,
  onSaveSlots,
  onGenerateSlots,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onReplan,
  onShareWorkflow,
}: Props) {
  const router = useRouter();
  const { alert, toast } = useDialogs();
  const [toolbarBusy, setToolbarBusy] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const hasSlots = project.output.slots.length > 0;
  const showHero = !hasSlots && project.references.length === 0;
  const disabledAll = Boolean(planning) || Boolean(generating) || Boolean(refBusy);

  const readyCount = useMemo(
    () => project.output.slots.filter((s) => s.imageUrl?.trim()).length,
    [project.output.slots],
  );
  const assetIds = useMemo(
    () =>
      project.output.slots
        .map((s) => s.assetId)
        .filter((id): id is string => Boolean(id)),
    [project.output.slots],
  );
  const canSave =
    project.references.length > 0 ||
    project.output.slots.length > 0 ||
    Boolean(project.meta.sellpointDocument?.trim());
  const structureTotal = totalStructureCount(project.settings.structure);
  const defaultSaveProductName = project.title?.trim() || "商品套图";

  async function handleExportZip() {
    setToolbarBusy("export");
    try {
      await downloadProductImageSetExportZip(project.id);
    } catch (e) {
      await alert({
        title: "导出失败",
        message: e instanceof Error ? e.message : "未知错误",
        variant: "error",
      });
    } finally {
      setToolbarBusy(null);
    }
  }

  async function handleSaveWorkflow(productName: string) {
    setToolbarBusy("save");
    try {
      const snapshot = await saveProductImageSetWorkflow(project.id, productName);
      setSaveDialogOpen(false);
      toast({
        title: "已保存工作流",
        message: `「${snapshot.title}」已写入项目镜像，可在资产库对应类目复用（若已接入）。`,
        variant: "success",
      });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setToolbarBusy(null);
    }
  }

  async function handleGoToVideo() {
    if (assetIds.length === 0) {
      await alert({
        title: "还没有可用图片",
        message: "请先在槽位出图并入库，再去做视频。",
        variant: "error",
      });
      return;
    }
    setToolbarBusy("video");
    try {
      const { projectId } = await createStoryboardFromAssets({
        assetIds,
        title: project.title ?? "商品套图视频",
        role: "product",
      });
      writeEcomLastProjectId(STORYBOARD_PROJECT_STORAGE_KEY, projectId);
      router.push("/ecom/storyboard/micro-drama");
    } catch (e) {
      await alert({
        title: "跳转失败",
        message: e instanceof Error ? e.message : "无法创建故事版",
        variant: "error",
      });
    } finally {
      setToolbarBusy(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="shrink-0 border-b border-[#e8e8ed] bg-white px-4 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">
              {project.title?.trim() || "AI 商品套图"}
            </h2>
            <p className="text-[11px] text-[#6e6e73]">
              结构 {structureTotal} 张
              {hasSlots ? ` · 占位 ${project.output.slots.length} · 已出 ${readyCount}` : ""}
              {project.references.length > 0 ? ` · 原图 ${project.references.length}` : ""}
            </p>
          </div>
          <EcomIconToolbar>
            <EcomIconToolbarGroup label="项目">
              {onNewProject ? (
                <EcomIconButton
                  label="新建项目"
                  icon={Plus}
                  disabled={disabledAll || Boolean(toolbarBusy)}
                  onClick={() => void onNewProject()}
                />
              ) : null}
              {loadProjectList && onOpenProject ? (
                <EcomProjectListButton
                  disabled={disabledAll || Boolean(toolbarBusy)}
                  currentProjectId={project.id}
                  loadProjects={loadProjectList}
                  onSelectProject={onOpenProject}
                  title="AI 商品套图 · 项目列表"
                  emptyHint="还没有保存过的商品套图项目。"
                />
              ) : null}
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="编辑">
              {onReplan ? (
                <EcomIconButton
                  label="重新生成占位"
                  icon={RefreshCw}
                  disabled={
                    disabledAll ||
                    Boolean(toolbarBusy) ||
                    structureTotal === 0
                  }
                  onClick={() => void onReplan()}
                />
              ) : null}
              <EcomIconButton
                label="保存工作流"
                icon={Save}
                disabled={!canSave || disabledAll || Boolean(toolbarBusy)}
                onClick={() => setSaveDialogOpen(true)}
              />
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="交付">
              <EcomIconButton
                label="导出交付包"
                icon={Download}
                disabled={readyCount === 0 || Boolean(toolbarBusy)}
                onClick={() => void handleExportZip()}
              />
              <EcomIconButton
                label="去做视频"
                icon={Film}
                disabled={assetIds.length === 0 || Boolean(toolbarBusy) || disabledAll}
                onClick={() => void handleGoToVideo()}
              />
            </EcomIconToolbarGroup>
            {onShareWorkflow ? (
              <EcomIconToolbarGroup label="分享">
                <EcomShareIconButton
                  disabled={disabledAll || Boolean(toolbarBusy)}
                  onClick={onShareWorkflow}
                />
              </EcomIconToolbarGroup>
            ) : null}
          </EcomIconToolbar>
        </div>
      </header>

      <div className="border-b border-[#e8e8ed] px-4 py-3">
        <div className="flex items-center gap-1">
          <h1 className="text-sm font-semibold text-[#1d1d1f]">商品原图</h1>
          <span
            className="text-[#86868b]"
            title="最多 6 张，第一张为主参考；AI 帮写会分析全部产品图。"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-3">
          <ProductImageSetRefUploader
            references={project.references}
            busy={refBusy}
            onUpload={onUpload}
            onRemove={onRemoveRef}
          />
        </div>
      </div>

      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {planning ? (
          <StoryboardTaskStatus
            active
            sweep
            surface="content"
            title="正在生成套图占位"
            detail={productImageSetPlanBusyDetail(project)}
            className="mx-0 mb-4"
          />
        ) : null}
        {generating && !planning ? (
          <StoryboardTaskStatus
            active
            sweep
            surface="content"
            title="正在出图"
            detail={productImageSetGenerateBusyDetail(
              project,
              generatingSlotIds.size || undefined,
            )}
            className="mx-0 mb-4"
          />
        ) : null}
        {project.meta.planPromptSource === "fallback" && project.meta.planPromptError ? (
          <p className="mb-4 rounded-lg border border-[#ffd6d6] bg-[#fff5f5] px-3 py-2 text-[11px] leading-relaxed text-[#c93434]">
            上次 AI 规划失败：{project.meta.planPromptError}。当前 Prompt 为规则模板，请重试占位或手动编辑。
          </p>
        ) : null}
        {showHero ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">AI 商品套图</h2>
            <p className="mt-3 max-w-md text-sm text-[#6e6e73]">
              上传商品实拍，在右侧配置套图结构，点击「生成套图占位」后在此选择槽位出图。
            </p>
          </div>
        ) : null}

        {hasSlots ? (
          <ProductImageSetSlotWorkspace
            project={project}
            ratio={ratio}
            disabled={workspaceDisabled}
            generatingSlotIds={generatingSlotIds}
            onProjectChange={onProjectChange}
            onSaveSlots={onSaveSlots}
            onGenerateSlots={onGenerateSlots}
          />
        ) : null}

        {project.output.listingCopy ? (
          <section className="mt-6 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
            <h3 className="text-xs font-semibold text-[#1d1d1f]">上架文案</h3>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-[#424245]">
              {project.output.listingCopy}
            </pre>
          </section>
        ) : null}
      </div>

      <ProductDesignSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultProductName={defaultSaveProductName}
        busy={toolbarBusy === "save"}
        onConfirm={handleSaveWorkflow}
      />
    </div>
  );
}
