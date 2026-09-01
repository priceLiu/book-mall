"use client";

import { Check, Loader2, Pencil, Save, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

import { FilmPullConfirmScriptTable } from "@/components/film-pull/film-pull-confirm-script-table";
import { FilmPullProductionMediaStrip } from "@/components/film-pull/film-pull-production-media-strip";
import { FilmPullProductionScriptEditDialog } from "@/components/film-pull/film-pull-production-script-edit-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  assembleFilmPullProductionScript,
  confirmFilmPullProductionScript,
  saveFilmPullProductionPlan,
} from "@/lib/ecom-film-pull-api";
import { isFilmPullMockDevUiEnabled } from "@/lib/film-pull-mock-dev";
import {
  buildProductionPlanPatch,
  syncRefMatchWithProductionShots,
} from "@/lib/film-pull-production-script-utils";
import { FILM_PULL_SCRIPT_PREP_STEP_LABELS } from "@/lib/film-pull-production-workflow";
import type { FilmPullProductionShot, FilmPullProject } from "@/lib/film-pull-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  project: FilmPullProject;
  imageModels: StoryboardGatewayModel[];
  imageModelKey: string;
  videoModels: StoryboardGatewayModel[];
  videoModelKey: string;
  onImageModelChange: (key: string) => void;
  onVideoModelChange: (key: string) => void;
  modelsLoading?: boolean;
  onRefreshModels?: () => void;
  busy?: boolean;
  prepBusy?: boolean;
  prepStep?: number;
  prepError?: string | null;
  onRetryPrep?: () => void;
  onProjectUpdated: (project: FilmPullProject) => void;
  onPreviewVideo: (src: string, title?: string) => void;
  onPreviewImage?: (src: string, title: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

function ScriptPrepStepList({ activeStep }: { activeStep: number }) {
  return (
    <ol className="space-y-2 pt-1">
      {FILM_PULL_SCRIPT_PREP_STEP_LABELS.map((label, index) => {
        const stepNo = index + 1;
        const done = activeStep > stepNo;
        const active = activeStep === stepNo;
        return (
          <li key={label} className="flex items-start gap-2 text-xs leading-relaxed">
            {done ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34c759]" />
            ) : active ? (
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[#0071e3]" />
            ) : (
              <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-[#d2d2d7]" />
            )}
            <span
              className={cn(
                done && "text-[#6e6e73]",
                active && "font-medium text-[#1d1d1f]",
                !done && !active && "text-[#86868b]",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function FilmPullProductionWorkspace({
  project,
  imageModels,
  imageModelKey,
  videoModels,
  videoModelKey,
  onImageModelChange,
  onVideoModelChange,
  modelsLoading,
  onRefreshModels,
  busy,
  prepBusy,
  prepStep = 0,
  prepError,
  onRetryPrep,
  onProjectUpdated,
  onPreviewVideo,
  onPreviewImage,
  onAlert,
}: Props) {
  const [actionBusy, setActionBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [localPrepStep, setLocalPrepStep] = useState(0);
  const plan = project.productionPlan;
  const locked = busy || actionBusy || prepBusy;
  const showPrepProgress = Boolean(prepBusy && prepStep > 0);
  const showLocalPrepProgress = Boolean(actionBusy && localPrepStep > 0);
  const activePrepStep = showLocalPrepProgress ? localPrepStep : prepStep;
  const showEmpty = !plan?.shots.length;
  const aspectRatio = project.settings.aspectRatio ?? "9:16";

  const handleSaveScript = useCallback(
    async (shots: FilmPullProductionShot[], opts?: { confirm?: boolean }) => {
      if (!plan) return;
      setActionBusy(true);
      try {
        const productionPlan = buildProductionPlanPatch(plan, shots);
        const refMatch = syncRefMatchWithProductionShots(project.refMatch, productionPlan.shots);
        let updated = await saveFilmPullProductionPlan(project.id, productionPlan, { refMatch });
        if (opts?.confirm !== false && !updated.meta?.productionScriptConfirmedAt) {
          updated = await confirmFilmPullProductionScript(project.id);
        }
        onProjectUpdated(updated);
        setEditOpen(false);
      } catch (e) {
        await onAlert({
          title: "保存失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
      } finally {
        setActionBusy(false);
      }
    },
    [onAlert, onProjectUpdated, plan, project.id, project.refMatch],
  );

  async function handleAssemble(mock = false) {
    setActionBusy(true);
    setLocalPrepStep(1);
    try {
      setLocalPrepStep(3);
      setLocalPrepStep(4);
      let updated = await assembleFilmPullProductionScript(project.id, mock);
      if (!updated.meta?.productionScriptConfirmedAt) {
        updated = await confirmFilmPullProductionScript(project.id);
      }
      onProjectUpdated(updated);
      setLocalPrepStep(FILM_PULL_SCRIPT_PREP_STEP_LABELS.length);
    } catch (e) {
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "请稍后重试",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
      setLocalPrepStep(0);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">制作工作台</h2>
          <p className="text-[11px] text-[#6e6e73]">
            上方确认脚本表，下方逐镜生图/生视频并合成成片。
          </p>
        </div>
        {!showEmpty ? (
          <div className="flex flex-wrap gap-2">
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={locked}
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              编辑
            </EcomButtonSecondary>
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={locked}
              onClick={() => void handleAssemble(false)}
            >
              {actionBusy && !editOpen ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3.5 w-3.5" />
              )}
              重新组装
            </EcomButtonSecondary>
            {isFilmPullMockDevUiEnabled() ? (
              <EcomButtonSecondary
                size="sm"
                type="button"
                disabled={locked}
                onClick={() => void handleAssemble(true)}
              >
                Mock 组装
              </EcomButtonSecondary>
            ) : null}
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={locked}
              onClick={() => void handleSaveScript(plan!.shots)}
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              保存脚本
            </EcomButtonPrimary>
          </div>
        ) : null}
      </div>

      {showPrepProgress || showLocalPrepProgress ? (
        <>
          <StoryboardTaskStatus
            active
            sweep
            surface="content"
            title="正在生成制作脚本"
            detail="参考图匹配与脚本组装在后台进行，请稍候…"
            className="mx-0 mb-0"
          />
          <ScriptPrepStepList activeStep={activePrepStep} />
        </>
      ) : null}

      {prepError && showEmpty && !prepBusy ? (
        <div className="rounded-lg border border-[#ffd6d1] bg-[#fff5f3] px-3 py-2">
          <p className="text-sm text-[#c0392b]">生成失败：{prepError}</p>
          {onRetryPrep ? (
            <div className="mt-2">
              <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={() => void onRetryPrep()}>
                重试
              </EcomButtonSecondary>
            </div>
          ) : null}
        </div>
      ) : null}

      {showEmpty && !prepBusy && !prepError && !actionBusy ? (
        <p className="text-sm text-[#6e6e73]">素材就绪后系统将自动生成制作脚本，请稍候…</p>
      ) : null}

      {!showEmpty ? (
        <>
          <FilmPullConfirmScriptTable
            mode="preview"
            shots={plan!.shots}
            characterRefs={project.characterRefs}
          />

          <FilmPullProductionMediaStrip
            project={project}
            shots={plan!.shots}
            aspectRatio={aspectRatio}
            imageModels={imageModels}
            imageModelKey={imageModelKey}
            videoModels={videoModels}
            videoModelKey={videoModelKey}
            onImageModelChange={onImageModelChange}
            onVideoModelChange={onVideoModelChange}
            modelsLoading={modelsLoading}
            onRefreshModels={onRefreshModels}
            busy={busy || actionBusy}
            onProjectUpdated={onProjectUpdated}
            onPreviewVideo={onPreviewVideo}
            onPreviewImage={onPreviewImage}
            onAlert={onAlert}
          />

          <FilmPullProductionScriptEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            title="编辑确认脚本"
            description="修改分镜字段、参考图与生图/生视频 Prompt；支持 @图片N 引用。保存后更新工作台。"
            shots={plan!.shots}
            characterRefs={project.characterRefs}
            saving={actionBusy}
            onSave={(shots) => handleSaveScript(shots)}
          />
        </>
      ) : null}
    </div>
  );
}
