"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { MentionsEditable } from "@/components/canvas/mentions/MentionsEditable";
import {
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import {
  buildWizardAssetMentionables,
  type Pro2ProductionScriptShot,
} from "@/lib/canvas/pro2-production-wizard-assets";
import {
  hydrateShotEntityMentionsForEdit,
} from "@/lib/canvas/pro2-shot-entity-reconcile";
import { isShotReadyForPromptPolish } from "@/lib/canvas/pro2-shot-prompt-polish";
import { runPro2WizardShotPromptPolish } from "@/lib/canvas/pro2-wizard-shot-prompt-polish-run";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";
import { isPro2ProductionScriptV2 } from "@/lib/canvas/data/pro2-production-script-schema";
import { resolveShotPropNames } from "@/lib/canvas/pro2-production-script-render-md";
import { RF_FORM_CONTROL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { LIBTV_GENERATE_SETTINGS_MODAL_Z } from "@/lib/canvas/libtv-generate-settings-modal-z";
import { ENGINE_PICKER_MODAL_BG } from "@/lib/canvas/gateway-model-role";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { useCanvasStore } from "@/lib/canvas/store";
import { cn } from "@/lib/utils";
import {
  PRO2_WIZARD_INPUT_CLASS,
  PRO2_WIZARD_MENTIONS_CLASS,
  PRO2_WIZARD_PROMPT_MENTIONS_CLASS,
} from "./pro2-production-wizard-chrome";

export type Pro2ProductionWizardShotEditModalProps = {
  open: boolean;
  onClose: () => void;
  shot: Pro2ProductionScriptShot;
  script: Pro2ProductionScript;
  scriptHubId: string;
  hubData: StoryProScriptHubNodeData;
  outlineMd?: string;
  onSave: (patch: Partial<Pro2ProductionScriptShot>) => void;
};

export function Pro2ProductionWizardShotEditModal({
  open,
  onClose,
  shot,
  script,
  scriptHubId,
  hubData,
  outlineMd,
  onSave,
}: Pro2ProductionWizardShotEditModalProps) {
  const mounted = useClientPortalMounted();
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId) ?? "";
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { alert } = useDialogs();
  const useV2 = isPro2ProductionScriptV2(script.schemaVersion);

  const [shotSize, setShotSize] = useState(shot.shotSize ?? "");
  const [lighting, setLighting] = useState(shot.lighting ?? "");
  const [cameraMove, setCameraMove] = useState(shot.cameraMove ?? "");
  const [sceneDescription, setSceneDescription] = useState(
    shot.sceneDescription ?? "",
  );
  const [propNames, setPropNames] = useState(
    resolveShotPropNames(shot, script),
  );
  const [sceneId, setSceneId] = useState(shot.sceneId ?? "");
  const [dialogue, setDialogue] = useState(shot.dialogue ?? "—");
  const [durationSec, setDurationSec] = useState(
    shot.durationSec != null ? String(shot.durationSec) : "",
  );
  const [sfxNote, setSfxNote] = useState(shot.sfxNote ?? "");
  const [audioNote, setAudioNote] = useState(shot.audioNote ?? "");
  const [imagePrompt, setImagePrompt] = useState(
    shot.frameImagePrompt ?? shot.imagePrompt ?? "",
  );
  const [videoPrompt, setVideoPrompt] = useState(shot.videoPrompt ?? "");
  const [polishingModes, setPolishingModes] = useState<
    Set<"frame" | "video">
  >(() => new Set());

  const polishingFrame = polishingModes.has("frame");
  const polishingVideo = polishingModes.has("video");

  const liveShot = useMemo(
    () => script.shots?.find((s) => s.index === shot.index) ?? shot,
    [script.shots, shot],
  );

  const storedPromptKey = [
    liveShot.frameImagePrompt ?? "",
    liveShot.imagePrompt ?? "",
    liveShot.videoPrompt ?? "",
  ].join("\u0001");

  useEffect(() => {
    if (!open) return;

    const hydrated = hydrateShotEntityMentionsForEdit(liveShot, script, {
      propDisplayText: resolveShotPropNames(liveShot, script),
    });
    const { shot: reconciled } = hydrated;
    setShotSize(reconciled.shotSize ?? "");
    setLighting(reconciled.lighting ?? "");
    setCameraMove(reconciled.cameraMove ?? "");
    setSceneDescription(reconciled.sceneDescription ?? "");
    setPropNames(hydrated.propDisplayText);
    setSceneId(reconciled.sceneId ?? "");
    setDialogue(reconciled.dialogue ?? "—");
    setDurationSec(
      reconciled.durationSec != null ? String(reconciled.durationSec) : "",
    );
    setSfxNote(reconciled.sfxNote ?? "");
    setAudioNote(reconciled.audioNote ?? "");
    if (!polishingFrame) {
      setImagePrompt(
        reconciled.frameImagePrompt ?? reconciled.imagePrompt ?? "",
      );
    }
    if (!polishingVideo) {
      setVideoPrompt(reconciled.videoPrompt ?? "");
    }
  }, [open, liveShot, script, storedPromptKey, polishingFrame, polishingVideo]);

  useModalBodyScrollLock(open);
  useModalEscapeClose(onClose, { active: open });

  const mentionables = useMemo(
    () => buildWizardAssetMentionables(script, []),
    [script],
  );
  const propMentionables = useMemo(
    () => mentionables.filter((m) => m.kind === "prop"),
    [mentionables],
  );

  const buildDraftShot = useCallback((): Pro2ProductionScriptShot => {
    const duration = durationSec.trim()
      ? Number.parseFloat(durationSec.trim())
      : undefined;
    const draft: Pro2ProductionScriptShot = {
      ...shot,
      shotSize: shotSize.trim() || undefined,
      cameraMove: cameraMove.trim() || undefined,
      sceneDescription: sceneDescription.trim() || shot.sceneDescription,
      dialogue: dialogue.trim() || "—",
      durationSec:
        duration != null && Number.isFinite(duration) && duration > 0
          ? duration
          : undefined,
      audioNote: audioNote.trim(),
      videoPrompt: videoPrompt.trim() || undefined,
      sceneId: sceneId.trim() || undefined,
    };
    if (useV2) {
      draft.lighting = lighting.trim() || undefined;
      draft.sfxNote = sfxNote.trim() || undefined;
      draft.frameImagePrompt = imagePrompt.trim() || undefined;
    } else {
      draft.imagePrompt = imagePrompt.trim() || undefined;
    }
    return draft;
  }, [
    audioNote,
    cameraMove,
    dialogue,
    durationSec,
    imagePrompt,
    lighting,
    propNames,
    sceneDescription,
    sceneId,
    sfxNote,
    shot,
    shotSize,
    useV2,
    videoPrompt,
  ]);

  const runPolish = useCallback(
    async (mode: "frame" | "video") => {
      if (polishingModes.has(mode)) return;
      const draft = buildDraftShot();
      if (!isShotReadyForPromptPolish(draft)) {
        await alert({
          title: "无法润色",
          message:
            "分镜图 / 视频提示词可留空。请先填写上方 Pass 1 导演信息（画面描述、光影、运镜、对白等至少一项）。",
          variant: "warning",
        });
        return;
      }
      setPolishingModes((prev) => new Set(prev).add(mode));
      try {
        const propDisplay =
          propNames.trim() && propNames !== "—" ? propNames.trim() : "";
        const result = await runPro2WizardShotPromptPolish({
          base: base ?? "",
          projectId,
          scriptHubId,
          hubData,
          script,
          shotIndex: shot.index,
          draftShot: draft,
          mode,
          outlineMd,
          propDisplayText: propDisplay,
          updateNodeData,
        });
        if (!result.ok) {
          await alert({
            title: "AI 润色失败",
            message: result.error,
            variant: "error",
          });
          return;
        }
        if (result.frameImagePrompt) {
          setImagePrompt(result.frameImagePrompt);
        }
        if (result.videoPrompt) {
          setVideoPrompt(result.videoPrompt);
        }
      } finally {
        setPolishingModes((prev) => {
          const next = new Set(prev);
          next.delete(mode);
          return next;
        });
      }
    },
    [
      alert,
      base,
      buildDraftShot,
      hubData,
      outlineMd,
      polishingModes,
      projectId,
      propNames,
      script,
      scriptHubId,
      shot.index,
      updateNodeData,
    ],
  );

  const onConfirm = useCallback(() => {
    const draft = buildDraftShot();
    const propDisplay =
      propNames.trim() && propNames !== "—" ? propNames.trim() : "";
    const { shot: hydrated } = hydrateShotEntityMentionsForEdit(draft, script, {
      propDisplayText: propDisplay,
    });
    const patch: Partial<Pro2ProductionScriptShot> = {
      shotSize: hydrated.shotSize,
      cameraMove: hydrated.cameraMove,
      sceneDescription: hydrated.sceneDescription,
      dialogue: hydrated.dialogue,
      durationSec: hydrated.durationSec,
      audioNote: hydrated.audioNote,
      videoPrompt: hydrated.videoPrompt,
      sceneId: hydrated.sceneId,
      characterIds: hydrated.characterIds,
      propIds: hydrated.propIds,
    };
    if (useV2) {
      patch.lighting = hydrated.lighting;
      patch.sfxNote = hydrated.sfxNote;
      patch.frameImagePrompt = hydrated.frameImagePrompt;
    } else {
      patch.imagePrompt = hydrated.imagePrompt;
    }
    onSave(patch);
    onClose();
  }, [
    buildDraftShot,
    onClose,
    onSave,
    propNames,
    script,
    useV2,
  ]);

  if (!mounted || !open) return null;

  const mentionFieldClass = cn(
    RF_FORM_CONTROL,
    RF_NO_WHEEL,
    PRO2_WIZARD_MENTIONS_CLASS,
  );
  const framePromptFieldClass = cn(
    RF_FORM_CONTROL,
    RF_NO_WHEEL,
    PRO2_WIZARD_PROMPT_MENTIONS_CLASS,
    polishingFrame ? "pointer-events-none opacity-70" : "",
  );
  const videoPromptFieldClass = cn(
    RF_FORM_CONTROL,
    RF_NO_WHEEL,
    PRO2_WIZARD_PROMPT_MENTIONS_CLASS,
    polishingVideo ? "pointer-events-none opacity-70" : "",
  );

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      style={{ zIndex: LIBTV_GENERATE_SETTINGS_MODAL_Z, isolation: "isolate" }}
      role="dialog"
      aria-modal="true"
      aria-label={`编辑分镜 镜 ${shot.index}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="nodrag nowheel flex h-[50vh] w-[50vw] min-h-[360px] min-w-[360px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl"
        style={{ backgroundColor: ENGINE_PICKER_MODAL_BG }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
          <div>
            <p className="text-[13px] font-semibold text-white">
              镜 {shot.index} · 分镜编辑
            </p>
            <p className="text-[10px] text-white/45">
              修改后保存会同步更新 Hub 分镜表与 productionScript
            </p>
          </div>
          <button
            type="button"
            className="grid size-7 shrink-0 place-items-center rounded-md text-white/50 hover:bg-white/8"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="景别">
              <input
                className={PRO2_WIZARD_INPUT_CLASS}
                value={shotSize}
                onChange={(e) => setShotSize(e.target.value)}
                placeholder="特写 / 全景…"
              />
            </Field>
            <Field label="时长(秒)">
              <input
                className={PRO2_WIZARD_INPUT_CLASS}
                inputMode="decimal"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                placeholder="5"
              />
            </Field>
          </div>

          <Field label="画面描述（@ 引用角色 / 场景 / 道具）">
            <MentionsEditable
              className={mentionFieldClass}
              placeholder="画面描述…"
              value={sceneDescription}
              mentionables={mentionables}
              mentionEdition="wizard"
              onChange={setSceneDescription}
            />
          </Field>

          {useV2 ? (
            <Field label="光影（@ 引用角色 / 场景 / 道具）">
              <MentionsEditable
                className={cn(mentionFieldClass, "min-h-[64px]")}
                placeholder="光影描述…"
                value={lighting}
                mentionables={mentionables}
                mentionEdition="wizard"
                onChange={setLighting}
              />
            </Field>
          ) : null}

          <Field label="运镜（@ 引用角色 / 场景 / 道具）">
            <MentionsEditable
              className={cn(mentionFieldClass, "min-h-[64px]")}
              placeholder="运镜描述…"
              value={cameraMove}
              mentionables={mentionables}
              mentionEdition="wizard"
              onChange={setCameraMove}
            />
          </Field>

          {useV2 ? (
            <>
              <Field label="场景">
                <select
                  className={PRO2_WIZARD_INPUT_CLASS}
                  value={sceneId}
                  onChange={(e) => setSceneId(e.target.value)}
                >
                  <option value="">— 未选择 —</option>
                  {(script.scenes ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="道具（@ 引用道具 · 或多个用顿号）">
                <MentionsEditable
                  className={cn(mentionFieldClass, "min-h-[48px]")}
                  placeholder="@ 引用道具或输入名称…"
                  value={propNames === "—" ? "" : propNames}
                  mentionables={propMentionables}
                  mentionEdition="wizard"
                  onChange={setPropNames}
                />
              </Field>
            </>
          ) : null}

          <Field label="对白（@ 引用角色 / 场景 / 道具）">
            <MentionsEditable
              className={cn(mentionFieldClass, "min-h-[72px]")}
              placeholder="对白…"
              value={dialogue === "—" ? "" : dialogue}
              mentionables={mentionables}
              mentionEdition="wizard"
              onChange={(v) => setDialogue(v.trim() ? v : "—")}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {useV2 ? (
              <Field label="音效">
                <input
                  className={PRO2_WIZARD_INPUT_CLASS}
                  value={sfxNote}
                  onChange={(e) => setSfxNote(e.target.value)}
                />
              </Field>
            ) : null}
            <Field label="口型/配音备注">
              <input
                className={PRO2_WIZARD_INPUT_CLASS}
                value={audioNote}
                onChange={(e) => setAudioNote(e.target.value)}
              />
            </Field>
          </div>

          <PromptField
            label={useV2 ? "分镜图 prompt（@ 引用角色 / 场景 / 道具）" : "AI 生图提示词（@ 引用）"}
            value={imagePrompt}
            onChange={setImagePrompt}
            mentionables={mentionables}
            fieldClassName={framePromptFieldClass}
            polishing={polishingFrame}
            onPolish={() => void runPolish("frame")}
          />

          <PromptField
            label="AI 视频提示词（@ 引用角色 / 场景 / 道具）"
            value={videoPrompt}
            onChange={setVideoPrompt}
            mentionables={mentionables}
            fieldClassName={videoPromptFieldClass}
            polishing={polishingVideo}
            onPolish={() => void runPolish("video")}
          />
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-white/[0.06] px-4 py-2.5">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/6"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-md bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-500"
            onClick={onConfirm}
          >
            保存
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-white/55">{label}</span>
      {children}
    </label>
  );
}

function PromptField({
  label,
  value,
  onChange,
  mentionables,
  fieldClassName,
  polishing,
  onPolish,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mentionables: ReturnType<typeof buildWizardAssetMentionables>;
  fieldClassName: string;
  polishing: boolean;
  onPolish: () => void;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-white/55">{label}</span>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200/90 transition hover:bg-violet-500/20",
            polishing && "pointer-events-none opacity-70",
          )}
          disabled={polishing}
          onClick={onPolish}
        >
          {polishing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          AI 润色
        </button>
      </div>
      <MentionsEditable
        className={fieldClassName}
        placeholder="留空可 AI 润色 · 依上方导演表自动生成"
        value={value}
        mentionables={mentionables}
        mentionEdition="wizard"
        disabled={polishing}
        onChange={onChange}
      />
    </label>
  );
}
