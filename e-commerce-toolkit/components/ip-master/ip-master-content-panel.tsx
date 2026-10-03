"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Images, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { IpMasterLibrarySaveDialog } from "@/components/ip-master/ip-master-library-save-dialog";
import { IpMasterSaveDialog } from "@/components/ip-master/ip-master-save-dialog";
import { IpMasterBenchmarkPreviewPanel } from "@/components/ip-master/ip-master-benchmark-preview-panel";
import { IpMasterImagePromptEditor } from "@/components/ip-master/ip-master-image-prompt-editor";
import { IpMasterTemplateEditor } from "@/components/ip-master/ip-master-template-editor";
import { IpMasterTemplateGeneratingShell } from "@/components/ip-master/ip-master-template-generating-shell";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import {
  IpMasterHelpHover,
  IpMasterInputModeHelpTable,
} from "@/components/ip-master/ip-master-help-hover";
import { IpMasterInputStep } from "@/components/ip-master/ip-master-input-step";
import type { IpMasterInputMode } from "@/lib/ip-master-input-presets";
import type {
  IpMasterImagePrompt,
  IpMasterRegenerateTarget,
  IpMasterTemplate,
} from "@/lib/ip-master-template-types";
import { buildDefaultIpMasterLibraryLabel } from "@/lib/ip-master-library-label";
import { isIpMasterVisionChatModel } from "@/lib/ip-master-template-chat-model";
import type { IpMasterProject, IpMasterStepId } from "@/lib/ip-master-types";
import { ipMasterStep } from "@/lib/ip-master-workflow";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

type Props = {
  project: IpMasterProject;
  currentStepId: IpMasterStepId;
  draftTemplate: IpMasterTemplate;
  onDraftTemplateChange: (t: IpMasterTemplate) => void;
  onStepChange: (stepId: IpMasterStepId) => void;
  onRefUpload: (file: File) => Promise<void>;
  refBusy?: boolean;
  uploadProgress?: number | null;
  onSaveVersion: (libraryLabel: string) => Promise<void>;
  saveVersionBusy?: boolean;
  onSaveWorkflow: (ipName: string) => Promise<void>;
  onNewProject: () => void;
  loadProjectList: () => Promise<
    Array<{ id: string; title: string; updatedAt: string; thumbnailUrl: string | null }>
  >;
  onOpenProject: (id: string) => void;
  onDeleteProject: () => void;
  onBriefChange: (text: string) => Promise<void>;
  inputMode: IpMasterInputMode;
  onInputModeChange: (mode: IpMasterInputMode) => void;
  onGenerateBenchmark: () => Promise<void>;
  benchmarkGenBusy?: boolean;
  onGenerateTemplate: () => void;
  onRegenerateTemplate: (target: IpMasterRegenerateTarget) => void;
  templateGenBusy?: boolean;
  chatModels: StoryboardGatewayModel[];
  chatModelKey: string;
  onChatModelKeyChange: (key: string) => void;
  modelsLoading?: boolean;
};

export function IpMasterContentPanel({
  project,
  currentStepId,
  draftTemplate,
  onDraftTemplateChange,
  onStepChange,
  onRefUpload,
  refBusy,
  uploadProgress,
  onSaveVersion,
  saveVersionBusy,
  onSaveWorkflow,
  onNewProject,
  loadProjectList,
  onOpenProject,
  onDeleteProject,
  onBriefChange,
  inputMode,
  onInputModeChange,
  onGenerateBenchmark,
  benchmarkGenBusy,
  onGenerateTemplate,
  onRegenerateTemplate,
  templateGenBusy,
  chatModels,
  chatModelKey,
  onChatModelKeyChange,
  modelsLoading,
}: Props) {
  const router = useRouter();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [librarySaveOpen, setLibrarySaveOpen] = useState(false);

  const briefText =
    typeof project.brief?.description === "string" ? project.brief.description : "";
  const versions = project.meta?.templateVersions ?? [];
  const activeVersion = project.meta?.workflow?.activeVersion;
  const busy = Boolean(refBusy || benchmarkGenBusy || templateGenBusy || saveVersionBusy);

  const imagePrompt: IpMasterImagePrompt = draftTemplate.imagePrompt ?? {
    positive: "",
    negative: "",
  };

  function setImagePrompt(next: IpMasterImagePrompt) {
    onDraftTemplateChange({ ...draftTemplate, imagePrompt: next });
  }

  const defaultLibraryLabel = buildDefaultIpMasterLibraryLabel(
    project,
    draftTemplate.ipMeta.ipName,
  );

  const showInputSection =
    currentStepId === "input" || currentStepId === "review" || currentStepId === "versions";
  const showReviewSection = currentStepId === "review" || currentStepId === "versions";
  const inputStep = ipMasterStep("input");
  const reviewStep = ipMasterStep("review");

  function renderStepHeader(step: typeof inputStep, opts?: { help?: boolean }) {
    return (
      <header className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
          第 {step.no} 步 · {step.label}
        </p>
        <h2 className="flex items-center text-xl font-semibold text-[#1d1d1f]">
          {step.summary}
          {opts?.help ? (
            <IpMasterHelpHover ariaLabel="四种输入模式说明" wide>
              <IpMasterInputModeHelpTable />
            </IpMasterHelpHover>
          ) : null}
        </h2>
      </header>
    );
  }

  function renderInputSection() {
    return (
      <>
        {renderStepHeader(inputStep, { help: true })}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-xs text-[#6e6e73]">
            结构化解析模型
            {project.references.length > 0 && !isIpMasterVisionChatModel(chatModelKey) ? (
              <span className="ml-2 text-[11px] text-[#b45309]">
                已上传基准图时请选 VL 识图模型（如 Qwen3.8 Max）
              </span>
            ) : null}
            <select
              className="ml-2 rounded-lg border border-[#d2d2d7] px-2 py-1.5 text-xs"
              disabled={modelsLoading || busy}
              value={chatModelKey}
              onChange={(e) => onChatModelKeyChange(e.target.value)}
            >
              {chatModels.map((m) => (
                <option key={m.modelKey} value={m.modelKey}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <IpMasterTemplateGeneratingShell
          generating={templateGenBusy}
          className="space-y-4"
          minHeightClass="min-h-[16rem]"
        >
          <IpMasterInputStep
            project={project}
            inputMode={inputMode}
            onInputModeChange={onInputModeChange}
            briefText={briefText}
            onBriefChange={(t) => void onBriefChange(t)}
            onRefUpload={onRefUpload}
            onGenerateBenchmark={onGenerateBenchmark}
            refBusy={refBusy}
            benchmarkGenBusy={benchmarkGenBusy}
            uploadProgress={uploadProgress}
            generateTemplateBusy={templateGenBusy}
            onGenerateTemplate={onGenerateTemplate}
          />
        </IpMasterTemplateGeneratingShell>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[#e8e8ed] px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">
              {project.title?.trim() || "IP 母版"}
            </h2>
            <p className="text-[11px] text-[#6e6e73]">
              母版库 = 基准图 + 结构化模板 · 手办 / 品牌 VI 可选导入
              {activeVersion ? ` · 当前 ${activeVersion}` : ""}
            </p>
          </div>
          <EcomIconToolbar>
            <EcomIconToolbarGroup label="项目">
              <EcomIconButton label="新建项目" icon={Plus} onClick={onNewProject} />
              <EcomProjectListButton
                currentProjectId={project.id}
                loadProjects={loadProjectList}
                onSelectProject={onOpenProject}
                title="IP 母版 · 项目列表"
                emptyHint="还没有 IP 母版项目。"
              />
              <EcomIconButton
                label="删除项目"
                icon={Trash2}
                variant="destructive"
                onClick={onDeleteProject}
              />
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="工作流">
              <EcomIconButton label="保存工作流" icon={Save} onClick={() => setSaveOpen(true)} />
            </EcomIconToolbarGroup>
            <EcomIconToolbarGroup label="资产">
              <EcomIconButton
                label="我的资产"
                icon={Images}
                onClick={() => router.push("/library?tab=ip-master-library")}
              />
            </EcomIconToolbarGroup>
          </EcomIconToolbar>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {showInputSection ? renderInputSection() : null}

        {showReviewSection ? (
          <section
            className={showInputSection ? "mt-10 border-t border-[#e8e8ed] pt-8" : undefined}
          >
            {renderStepHeader(reviewStep)}
            <IpMasterTemplateGeneratingShell
              generating={templateGenBusy}
              className="space-y-4 p-1"
              minHeightClass="min-h-[24rem]"
            >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#6e6e73]">
                确认生图提示词与结构化字段后，再生成基准图并保存进母版库（手办 / VI 可选导入）。
              </p>
              <EcomButtonPrimary
                size="sm"
                type="button"
                disabled={saveVersionBusy || busy || project.references.length === 0}
                onClick={() => setLibrarySaveOpen(true)}
              >
                {saveVersionBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                保存进母版库
              </EcomButtonPrimary>
            </div>

            <IpMasterImagePromptEditor
              value={imagePrompt}
              onChange={setImagePrompt}
              disabled={busy}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
              <div className="order-2 min-w-0 space-y-4 lg:order-1">
                <div className="flex flex-wrap gap-2 border-t border-[#e8e8ed] pt-4">
                  <span className="w-full text-[11px] text-[#6e6e73]">
                    基于当前草稿重新生成（不会自动生图或入库）：
                  </span>
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => onRegenerateTemplate("both")}
                  >
                    全部重生成
                  </EcomButtonSecondary>
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => onRegenerateTemplate("imagePrompt")}
                  >
                    仅重生图提示词
                  </EcomButtonSecondary>
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    disabled={busy}
                    onClick={() => onRegenerateTemplate("structured")}
                  >
                    仅重结构化模板
                  </EcomButtonSecondary>
                </div>

                <IpMasterTemplateEditor
                  template={draftTemplate}
                  onChange={onDraftTemplateChange}
                  disabled={busy}
                />
              </div>

              <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-3">
                <IpMasterBenchmarkPreviewPanel
                  ossUrl={project.references[0]?.ossUrl}
                  generating={benchmarkGenBusy}
                  generateDisabled={busy || !imagePrompt.positive.trim()}
                  onGenerate={() => void onGenerateBenchmark()}
                />
              </div>
            </div>
            </IpMasterTemplateGeneratingShell>
          </section>
        ) : null}

        {currentStepId === "versions" && versions.length > 0 ? (
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
              母版库版本
            </p>
            <ul className="mt-2 space-y-2">
              {[...versions].reverse().map((v) => (
                <li key={v.version}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-[#e8e8ed] px-3 py-2 text-left text-sm hover:bg-[#f5f5f7]"
                    onClick={() => {
                      if (v.json && typeof v.json === "object") {
                        onDraftTemplateChange(v.json as IpMasterTemplate);
                      }
                      onStepChange("review");
                    }}
                  >
                    <span className="font-medium">{v.label?.trim() || v.version}</span>
                    <span className="text-[11px] text-[#86868b]">
                      {v.version} · {v.source} · {new Date(v.createdAt).toLocaleString("zh-CN")}
                      {v.version === activeVersion ? " · 当前" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <IpMasterSaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        defaultIpName={project.title?.trim() || "IP母版"}
        busy={saveBusy}
        onConfirm={async (ipName) => {
          setSaveBusy(true);
          try {
            await onSaveWorkflow(ipName);
            setSaveOpen(false);
          } finally {
            setSaveBusy(false);
          }
        }}
      />

      <IpMasterLibrarySaveDialog
        open={librarySaveOpen}
        onOpenChange={setLibrarySaveOpen}
        defaultLabel={defaultLibraryLabel}
        busy={saveVersionBusy}
        onConfirm={async (libraryLabel) => {
          await onSaveVersion(libraryLabel);
          setLibrarySaveOpen(false);
        }}
      />

    </div>
  );
}
