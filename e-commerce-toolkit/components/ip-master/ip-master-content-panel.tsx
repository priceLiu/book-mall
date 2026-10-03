"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, Images, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { IpMasterSaveDialog } from "@/components/ip-master/ip-master-save-dialog";
import { EcomProjectListButton } from "@/components/layout/ecom-project-list-button";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomIconButton } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { IpMasterProject, IpMasterStepId } from "@/lib/ip-master-types";
import { activeTemplateMarkdown, ipMasterStep } from "@/lib/ip-master-workflow";

type Props = {
  project: IpMasterProject;
  currentStepId: IpMasterStepId;
  draftMarkdown: string;
  onDraftMarkdownChange: (markdown: string) => void;
  onStepChange: (stepId: IpMasterStepId) => void;
  onRefUpload: (file: File) => Promise<void>;
  refBusy?: boolean;
  uploadProgress?: number | null;
  onSaveVersion: () => Promise<void>;
  saveVersionBusy?: boolean;
  onSaveWorkflow: (ipName: string) => Promise<void>;
  onNewProject: () => void;
  loadProjectList: () => Promise<
    Array<{ id: string; title: string; updatedAt: string; thumbnailUrl: string | null }>
  >;
  onOpenProject: (id: string) => void;
  onDeleteProject: () => void;
  onRequestExtract: () => void;
  onBriefChange: (text: string) => Promise<void>;
  streaming?: boolean;
};

export function IpMasterContentPanel({
  project,
  currentStepId,
  draftMarkdown,
  onDraftMarkdownChange,
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
  onRequestExtract,
  onBriefChange,
  streaming,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const step = ipMasterStep(currentStepId);
  const briefText =
    typeof project.brief?.description === "string" ? project.brief.description : "";
  const versions = project.meta?.templateVersions ?? [];
  const activeVersion = project.meta?.workflow?.activeVersion;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[#e8e8ed] px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">
              {project.title?.trim() || "IP 母版"}
            </h2>
            <p className="text-[11px] text-[#6e6e73]">
              固定基准图 + 模板版本 · 供手办 / 品牌VI 载入
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
                onClick={() => router.push("/library")}
              />
            </EcomIconToolbarGroup>
          </EcomIconToolbar>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <header className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            第 {step.no} 步 · {step.label}
          </p>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">{step.summary}</h1>
        </header>

        {(currentStepId === "input" || currentStepId === "extract") && (
          <div className="mb-6 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
                  角色基准图
                </span>
                <span className="text-[10px] text-[#86868b]">{IMAGE_UPLOAD_DROP_HINT}</span>
              </div>
              <EcomRefUploadCard
                title="基准图"
                items={project.references.map((r) => ({
                  id: r.id,
                  ossUrl: r.ossUrl,
                  label: r.label,
                }))}
                emptyHint="上传 1 张已定稿基准立绘（可选，可与文字描述组合）"
                removeLabel="删除"
                busy={refBusy}
                showUploadProgress={typeof uploadProgress === "number"}
                uploadProgress={uploadProgress}
                inputRef={inputRef}
                onOpenFilePicker={() => inputRef.current?.click()}
                onUploadFiles={(files) => {
                  const f = files[0];
                  if (f) void onRefUpload(f);
                }}
              />
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onRefUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
                文字描述 / Brief
              </label>
              <textarea
                className="mt-2 min-h-[120px] w-full rounded-xl border border-[#d2d2d7] px-3 py-2 text-sm"
                placeholder="IP 名称、世界观、外形关键词、禁忌项…"
                defaultValue={briefText}
                onBlur={(e) => void onBriefChange(e.target.value)}
                disabled={streaming}
              />
            </div>
            {currentStepId === "extract" ? (
              <EcomButtonPrimary type="button" disabled={streaming} onClick={onRequestExtract}>
                在助手中发起解析
              </EcomButtonPrimary>
            ) : null}
          </div>
        )}

        {(currentStepId === "review" ||
          currentStepId === "versions" ||
          currentStepId === "extract") && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
                模板 Markdown
              </span>
              <div className="flex gap-2">
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(draftMarkdown || activeTemplateMarkdown(project));
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </EcomButtonSecondary>
                <EcomButtonPrimary
                  size="sm"
                  type="button"
                  disabled={saveVersionBusy || !draftMarkdown.trim()}
                  onClick={() => void onSaveVersion()}
                >
                  {saveVersionBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  保存新版本
                </EcomButtonPrimary>
              </div>
            </div>
            <textarea
              className="min-h-[320px] w-full rounded-xl border border-[#d2d2d7] px-3 py-2 font-mono text-xs leading-relaxed"
              value={draftMarkdown}
              onChange={(e) => onDraftMarkdownChange(e.target.value)}
              placeholder="助手解析结果会出现在此处，可人工校对后保存版本…"
            />
          </div>
        )}

        {currentStepId === "versions" && versions.length > 0 ? (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
              版本历史
            </p>
            <ul className="mt-2 space-y-2">
              {[...versions].reverse().map((v) => (
                <li key={v.version}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-[#e8e8ed] px-3 py-2 text-left text-sm hover:bg-[#f5f5f7]"
                    onClick={() => {
                      onDraftMarkdownChange(v.markdown);
                      onStepChange("review");
                    }}
                  >
                    <span className="font-medium">{v.version}</span>
                    <span className="text-[11px] text-[#86868b]">
                      {v.source} · {new Date(v.createdAt).toLocaleString("zh-CN")}
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
    </div>
  );
}
