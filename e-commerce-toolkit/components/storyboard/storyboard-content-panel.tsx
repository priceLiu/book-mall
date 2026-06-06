"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { isEcomUnauthorizedError } from "@/lib/ecom-auth";
import {
  ensureEcomSessionFresh,
  redirectEcomSessionRefresh,
} from "@/lib/ecom-silent-sso";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { StoryboardDeliverableReviewDialog } from "@/components/storyboard/storyboard-deliverable-review-dialog";
import { StoryboardDeliverableSection } from "@/components/storyboard/storyboard-deliverable-section";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { StoryboardPanelCard } from "@/components/storyboard/storyboard-panel-card";
import { StoryboardPanelEditDialog } from "@/components/storyboard/storyboard-panel-edit-dialog";
import { StoryboardSheetPreviewDialog } from "@/components/storyboard/storyboard-sheet-preview-dialog";
import { StoryboardStepResults } from "@/components/storyboard/storyboard-step-results";
import type { StoryboardSettingsValue } from "@/components/storyboard/storyboard-settings-dialog";
import {
  generateStoryboardPanelVideo,
  generateStoryboardSheetImage,
  pollStoryboardFullVideoStatus,
  submitStoryboardFullVideo,
  mergeStoryboardPanelVideos,
  saveStoryboardDeliverableSnapshot,
  syncStoryboardSheet,
  updateStoryboardProject,
  uploadStoryboardSheetPng,
} from "@/lib/ecom-storyboard-api";
import type {
  StoryboardVideoResolution,
  StoryboardWanxSize,
} from "@/lib/storyboard-gen-params";
import {
  isStoryboardBailianR2vModel,
  aspectRatioFromR2vRatio,
} from "@/lib/storyboard-video-params";
import { isStoryboardImageUrl, isStoryboardVideoUrl } from "@/lib/storyboard-media";
import {
  hasAllPanelImages,
  hasSheetImagesReady,
  hasStoryboardProductRef,
} from "@/lib/storyboard-workflow";
import type {
  StoryboardGatewayModel,
  StoryboardProject,
  StoryboardReference,
  StoryboardSheet,
} from "@/lib/storyboard-types";

/** 整图成片前端轮询：间隔 4s × 240 ≈ 16 分钟（视频生成常超 6 分钟） */
const VIDEO_POLL_INTERVAL_MS = 4000;
const VIDEO_POLL_MAX_ITERS = 240;

type Props = {
  project: StoryboardProject;
  references: StoryboardReference[];
  imageModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
  settings: StoryboardSettingsValue;
  onOpenSettings?: () => void;
  onImageModelChange?: (key: string) => void;
  onVideoModelChange?: (key: string) => void;
  onImageSizeChange?: (v: StoryboardWanxSize) => void;
  onVideoResolutionChange?: (v: StoryboardVideoResolution) => void;
  onVideoR2vRatioChange?: (v: string) => void;
  onVideoSeedChange?: (v: string) => void;
  onVideoPromptExtendChange?: (v: boolean) => void;
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  onVideoAspectChange?: (v: "16:9" | "9:16" | "1:1") => void;
  videoAspectRatio?: "16:9" | "9:16" | "1:1";
  videoOssUrl?: string | null;
  streaming?: boolean;
  onProjectChange: (p: StoryboardProject) => void;
  onDurationChange: (v: number) => void;
  onAspectChange: (v: "16:9" | "9:16") => void;
  onPngReady: (url: string) => void;
  onVideoReady: () => void;
  onPrepareExport?: (sheet: StoryboardSheet) => void;
  capturePng: () => Promise<string>;
  onPreviewVideo: (src: string, title?: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  /** 助手区点击「生成全部分镜图」时递增，触发模型选择 */
  generateAllImagesToken?: number;
  /** 助手区点击「生成整图成片」时递增，触发视频模型选择 */
  generateFullVideoToken?: number;
  /** 助手区点击「合并分镜视频」时递增 */
  mergePanelVideosToken?: number;
};

function schemeToSheet(
  project: StoryboardProject,
  schemeIndex: number,
): StoryboardSheet | null {
  const scheme = project.meta?.deliverable?.schemes?.[schemeIndex];
  if (!scheme) return null;
  const params = project.meta?.deliverable?.params ?? {};
  const productHighlight =
    (typeof params.卖点 === "string" && params.卖点) ||
    (typeof params["核心卖点"] === "string" && params["核心卖点"]) ||
    scheme.strategy ||
    scheme.summary ||
    undefined;
  return {
    overview: {
      title: scheme.title,
      logline:
        scheme.summary ?? scheme.strategy ?? project.meta?.deliverable?.productName ?? "",
      productHighlight,
    },
    cast: [],
    panels: scheme.panels,
    totalDurationHintSec: scheme.totalDurationHintSec ?? 10,
  };
}

export function StoryboardContentPanel({
  project,
  references,
  imageModels,
  videoModels,
  settings,
  onOpenSettings,
  onImageModelChange,
  onVideoModelChange,
  onImageSizeChange,
  onVideoResolutionChange,
  onVideoR2vRatioChange,
  onVideoSeedChange,
  onVideoPromptExtendChange,
  durationSec,
  aspectRatio,
  videoAspectRatio = aspectRatio,
  onVideoAspectChange,
  videoOssUrl,
  streaming,
  onProjectChange,
  onDurationChange,
  onAspectChange,
  onPngReady,
  onVideoReady,
  onPrepareExport,
  capturePng,
  onPreviewVideo,
  onAlert,
  generateAllImagesToken,
  generateFullVideoToken,
  mergePanelVideosToken,
}: Props) {
  const [imgBusy, setImgBusy] = useState(false);
  const [sheetPngBusy, setSheetPngBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);
  const [videoTaskStartedAt, setVideoTaskStartedAt] = useState<string | null>(null);
  const [videoPollCount, setVideoPollCount] = useState(0);
  const videoPollLock = useRef(false);
  /** 已结束（失败/idle）的任务 id，防止 useEffect 反复自动轮询 */
  const videoPollDismissedTaskIdRef = useRef<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [savingPanel, setSavingPanel] = useState(false);
  const [regeneratingPanel, setRegeneratingPanel] = useState<number | null>(null);
  const [panelVidBusy, setPanelVidBusy] = useState<number | null>(null);
  const imageModel = settings.imageModelKey;
  const videoModel = settings.videoModelKey;
  const [editPanelIndex, setEditPanelIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"image" | "video">("image");
  const [pendingPanelIndex, setPendingPanelIndex] = useState<number | null>(null);
  const [pendingVideoTarget, setPendingVideoTarget] = useState<"panel" | "fullSheet">("fullSheet");
  const [sheetPreviewOpen, setSheetPreviewOpen] = useState(false);
  const [deliverableReviewOpen, setDeliverableReviewOpen] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [panelDurationSec, setPanelDurationSec] = useState(3);
  const imageSize = settings.imageSize;
  const videoResolution = settings.videoResolution;
  const videoR2vRatio = settings.videoR2vRatio ?? settings.aspectRatio ?? "9:16";
  const videoSeed = settings.videoSeed ?? "";
  const videoPromptExtend = settings.videoPromptExtend !== false;

  function openImagePicker(panelIndex?: number) {
    setPickerMode("image");
    setPendingPanelIndex(panelIndex ?? null);
    setPickerOpen(true);
  }

  function openVideoPicker(opts: { panelIndex?: number; fullSheet?: boolean }) {
    if (opts.fullSheet && vidBusy) return;
    setPickerMode("video");
    setPendingPanelIndex(opts.panelIndex ?? null);
    setPendingVideoTarget(opts.fullSheet ? "fullSheet" : "panel");
    if (typeof opts.panelIndex === "number" && project.sheet) {
      const panel = project.sheet.panels.find((p) => p.index === opts.panelIndex);
      setPanelDurationSec(
        Math.max(2, Math.min(8, Math.round(panel?.durationHintSec ?? 3))),
      );
    }
    setPickerOpen(true);
  }

  async function waitForExportImages() {
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    const el = document.getElementById("storyboard-sheet-export");
    if (!el) return;
    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.onload = done;
            img.onerror = done;
            setTimeout(done, 4000);
          }),
      ),
    );
    await new Promise((r) => setTimeout(r, 300));
  }

  const deliverable = project.meta?.deliverable;
  const schemes = deliverable?.schemes ?? [];
  const selectedIndex = project.meta?.selectedSchemeIndex ?? 0;
  const hasSheetImages = hasSheetImagesReady(project);

  function pickProjectKeywords(): string | undefined {
    const params = deliverable?.params ?? {};
    return (
      (typeof params["关键词"] === "string" && params["关键词"]) ||
      (typeof params.keywords === "string" && params.keywords) ||
      (typeof params["项目关键词"] === "string" && params["项目关键词"]) ||
      deliverable?.productName ||
      undefined
    );
  }

  async function adoptScheme(index: number) {
    const sheet = schemeToSheet(project, index);
    if (!sheet) return;
    const updated = await updateStoryboardProject(project.id, {
      sheet,
      meta: { ...project.meta, selectedSchemeIndex: index },
      settings: {
        ...project.settings,
        durationSec: sheet.totalDurationHintSec ?? durationSec,
      },
    });
    onProjectChange(updated);
    if (sheet.totalDurationHintSec) onDurationChange(sheet.totalDurationHintSec);
  }

  async function ensureSheetReady(): Promise<boolean> {
    if (project.sheet) return true;
    const sheet = schemeToSheet(project, selectedIndex);
    if (sheet) {
      const updated = await updateStoryboardProject(project.id, {
        sheet,
        meta: { ...project.meta, selectedSchemeIndex: selectedIndex },
      });
      onProjectChange(updated);
      return true;
    }
    try {
      const updated = await syncStoryboardSheet(project.id, {
        schemeIndex: selectedIndex,
      });
      onProjectChange(updated);
      return Boolean(updated.sheet);
    } catch {
      return false;
    }
  }

  async function compositeSheetPng(
    nextSheet: StoryboardSheet,
    nextReferences?: StoryboardReference[],
  ) {
    setSheetPngBusy(true);
    try {
      onProjectChange({
        ...project,
        sheet: nextSheet,
        references: nextReferences ?? project.references,
      });
      onPrepareExport?.(nextSheet);
      await waitForExportImages();
      const b64 = await capturePng();
      const url = await uploadStoryboardSheetPng(project.id, b64);
      onPngReady(url);
    } finally {
      setSheetPngBusy(false);
    }
  }

  async function handleGenerateImage(panelIndex?: number) {
    if (!hasStoryboardProductRef(project)) {
      await onAlert({
        title: "缺少产品图",
        message: "生成分镜图前须先上传产品图（必填）。",
        variant: "error",
      });
      return;
    }
    if (typeof panelIndex === "number") {
      setRegeneratingPanel(panelIndex);
    } else {
      setImgBusy(true);
    }
    try {
      const ready = await ensureSheetReady();
      if (!ready) {
        await onAlert({
          title: "无法生图",
          message:
            "当前仅有文本交付，缺少结构化分镜。请让助手重新输出完整方案，或回复「定稿」采用默认方案。",
        });
        return;
      }
      const { sheet: nextSheet, references: nextRefs } = await generateStoryboardSheetImage(
        project.id,
        {
          modelKey: imageModel,
          aspectRatio,
          imageSize,
          panelIndex,
        },
      );
      const allReady = nextSheet.panels.every((p) => Boolean(p.imageUrl));
      if (allReady) {
        await compositeSheetPng(nextSheet, nextRefs);
      } else {
        onProjectChange({
          ...project,
          sheet: nextSheet,
          references: nextRefs ?? project.references,
        });
      }
    } catch (e) {
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "分镜图生成失败",
        variant: "error",
      });
    } finally {
      setImgBusy(false);
      setRegeneratingPanel(null);
    }
  }

  async function handlePanelSave(updatedPanel: StoryboardSheet["panels"][0]) {
    if (!project.sheet) return;
    setSavingPanel(true);
    try {
      const panels = project.sheet.panels.map((p) =>
        p.index === updatedPanel.index
          ? { ...updatedPanel, imageUrl: undefined, videoUrl: undefined }
          : p,
      );
      const updated = await updateStoryboardProject(project.id, {
        sheet: { ...project.sheet, panels },
        sheetPngUrl: null,
      });
      onProjectChange(updated);
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "镜头保存失败",
        variant: "error",
      });
      throw e;
    } finally {
      setSavingPanel(false);
    }
  }

  const dismissVideoPoll = useCallback(
    (taskId?: string | null) => {
      videoPollDismissedTaskIdRef.current = taskId?.trim() || "__dismissed__";
      setVideoTaskStartedAt(null);
      onVideoReady();
    },
    [onVideoReady],
  );

  const pollFullVideoUntilDone = useCallback(async () => {
    if (videoPollLock.current) return;
    const activeTaskId = project.meta?.workflow?.pendingFullVideoJob?.taskId;
    if (
      activeTaskId &&
      videoPollDismissedTaskIdRef.current === activeTaskId
    ) {
      return;
    }
    videoPollLock.current = true;
    setVidBusy(true);
    let sessionRefreshing = false;
    let failMessage: string | null = null;
    let pollEnded = false;
    try {
      if (!(await ensureEcomSessionFresh(90))) {
        sessionRefreshing = true;
        return;
      }

      for (let i = 0; i < VIDEO_POLL_MAX_ITERS; i++) {
        setVideoPollCount(i + 1);

        if (i > 0 && i % 8 === 0) {
          if (!(await ensureEcomSessionFresh(90))) {
            sessionRefreshing = true;
            return;
          }
        }

        let polled;
        try {
          polled = await pollStoryboardFullVideoStatus(project.id);
        } catch (e) {
          if (isEcomUnauthorizedError(e)) {
            sessionRefreshing = true;
            redirectEcomSessionRefresh();
            return;
          }
          failMessage = e instanceof Error ? e.message : "视频生成失败";
          dismissVideoPoll(activeTaskId);
          pollEnded = true;
          break;
        }

        if (polled.status === "succeeded") {
          const ossUrl = polled.videoOssUrl ?? polled.asset?.ossUrl;
          if (ossUrl) {
            onProjectChange({
              ...project,
              videoOssUrl: ossUrl,
              videoAssetId: polled.asset.id,
            });
          }
          videoPollDismissedTaskIdRef.current = null;
          onVideoReady();
          setVideoTaskStartedAt(null);
          await onAlert({
            title: "整图成片已生成",
            message: `${durationSec}s · ${videoResolution} 带货视频已保存，并已自动保存交付快照。`,
          });
          return;
        }
        if (polled.status === "idle") {
          dismissVideoPoll(activeTaskId);
          pollEnded = true;
          break;
        }
        if (polled.startedAt) {
          setVideoTaskStartedAt(polled.startedAt);
        }

        await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
      }

      if (failMessage) {
        await onAlert({
          title: "生成失败",
          message: failMessage,
          variant: "error",
        });
      } else if (!pollEnded) {
        // 仅前端轮询超时：Gateway 任务仍在后台进行，结果可恢复，不算失败。
        // 标记本任务不再自动轮询，由用户点「刷新」恢复（避免重复生成重复计费）。
        videoPollDismissedTaskIdRef.current = activeTaskId ?? "__pending__";
        setVideoTaskStartedAt(null);
        await onAlert({
          title: "仍在生成中",
          message:
            "视频生成耗时较长，任务仍在后台进行。完成后点「刷新」即可获取结果，无需重新生成（重复生成会重复计费）。",
        });
      }
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        sessionRefreshing = true;
        redirectEcomSessionRefresh();
        return;
      }
      dismissVideoPoll(activeTaskId);
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "视频生成失败",
        variant: "error",
      });
    } finally {
      if (!sessionRefreshing) {
        videoPollLock.current = false;
        setVidBusy(false);
        setVideoPollCount(0);
      }
    }
  }, [
    dismissVideoPoll,
    durationSec,
    onAlert,
    onProjectChange,
    onVideoReady,
    project,
    videoResolution,
  ]);

  useEffect(() => {
    const pending = project.meta?.workflow?.pendingFullVideoJob;
    if (!pending?.taskId || !pending.startedAt) return;
    if (videoPollDismissedTaskIdRef.current === pending.taskId) return;
    if (vidBusy || videoPollLock.current) return;
    setVideoTaskStartedAt(pending.startedAt);
    void pollFullVideoUntilDone();
  }, [project.meta?.workflow?.pendingFullVideoJob?.taskId, pollFullVideoUntilDone, vidBusy]);

  /** 刷新：重载项目；若仍有未完成的整图成片任务，则恢复轮询拉取结果（不重新生成） */
  const handleReloadAndResumeVideo = useCallback(() => {
    onVideoReady();
    const pending = project.meta?.workflow?.pendingFullVideoJob;
    if (pending?.taskId && !vidBusy && !videoPollLock.current) {
      videoPollDismissedTaskIdRef.current = null;
      void pollFullVideoUntilDone();
    }
  }, [onVideoReady, project, vidBusy, pollFullVideoUntilDone]);

  const generateAllImagesTokenRef = useRef(0);
  useEffect(() => {
    if (!generateAllImagesToken || generateAllImagesToken <= generateAllImagesTokenRef.current) {
      return;
    }
    generateAllImagesTokenRef.current = generateAllImagesToken;
    openImagePicker();
  }, [generateAllImagesToken]);

  const generateFullVideoTokenRef = useRef(0);
  useEffect(() => {
    if (!generateFullVideoToken || generateFullVideoToken <= generateFullVideoTokenRef.current) {
      return;
    }
    generateFullVideoTokenRef.current = generateFullVideoToken;
    if (!hasSheetImagesReady(project)) {
      void onAlert({
        title: "提示",
        message: "请先在右侧生成全部分镜图。",
      });
      return;
    }
    openVideoPicker({ fullSheet: true });
  }, [generateFullVideoToken, project, onAlert]);

  const mergePanelVideosTokenRef = useRef(0);
  useEffect(() => {
    if (!mergePanelVideosToken || mergePanelVideosToken <= mergePanelVideosTokenRef.current) {
      return;
    }
    mergePanelVideosTokenRef.current = mergePanelVideosToken;
    void handleMergePanelVideos();
  }, [mergePanelVideosToken]);

  async function ensureSheetPngForVideo(): Promise<boolean> {
    if (!hasAllPanelImages(project) || !project.sheet) {
      await onAlert({ title: "提示", message: "请先生成全部分镜图。" });
      return false;
    }
    setSheetPngBusy(true);
    try {
      onPrepareExport?.(project.sheet);
      await waitForExportImages();
      const b64 = await capturePng();
      const url = await uploadStoryboardSheetPng(project.id, b64);
      onPngReady(url);
      return true;
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        redirectEcomSessionRefresh();
        return false;
      }
      await onAlert({
        title: "合成失败",
        message:
          e instanceof Error
            ? e.message
            : "完整分镜图 PNG 合成失败，无法整图成片。",
        variant: "error",
      });
      return false;
    } finally {
      setSheetPngBusy(false);
    }
  }

  async function handleGenerateFullVideo() {
    if (vidBusy) return;
    if (!hasAllPanelImages(project) || !project.sheet) {
      await onAlert({ title: "提示", message: "请先生成全部分镜图。" });
      return;
    }
    setVidBusy(true);
    setVideoPollCount(0);
    try {
      videoPollDismissedTaskIdRef.current = null;
      const submitted = await submitStoryboardFullVideo(project.id, {
        durationSec,
        aspectRatio: videoAspectRatio,
        resolution: videoResolution,
        modelKey: videoModel,
        ...(isStoryboardBailianR2vModel(videoModel)
          ? {
              ratio: videoR2vRatio,
              seedStr: videoSeed.trim() || undefined,
              promptExtend: videoPromptExtend,
            }
          : {}),
      });
      setVideoTaskStartedAt(submitted.startedAt);
      await pollFullVideoUntilDone();
    } catch (e) {
      if (isEcomUnauthorizedError(e)) {
        redirectEcomSessionRefresh();
        return;
      }
      setVidBusy(false);
      setVideoTaskStartedAt(null);
      dismissVideoPoll();
      await onAlert({
        title: "提交失败",
        message: e instanceof Error ? e.message : "视频任务提交失败",
        variant: "error",
      });
    }
  }

  async function handleGeneratePanelVideo(panelIndex: number) {
    if (!project.sheet?.panels.find((p) => p.index === panelIndex)?.imageUrl) {
      await onAlert({ title: "提示", message: "请先生成该镜头分镜图。" });
      return;
    }
    setPanelVidBusy(panelIndex);
    try {
      const { videoUrl } = await generateStoryboardPanelVideo(project.id, {
        panelIndex,
        aspectRatio,
        durationSec: panelDurationSec,
        resolution: videoResolution,
        modelKey: videoModel,
      });
      if (project.sheet) {
        const panels = project.sheet.panels.map((p) =>
          p.index === panelIndex ? { ...p, videoUrl } : p,
        );
        onProjectChange({ ...project, sheet: { ...project.sheet, panels } });
      }
      onVideoReady();
      await onAlert({
        title: "镜头视频已生成",
        message: `镜头 ${panelIndex} 视频已保存，交付快照已更新。≥2 镜可点「合并分镜视频」。`,
      });
    } catch (e) {
      await onAlert({
        title: "生成失败",
        message: e instanceof Error ? e.message : "镜头视频生成失败",
        variant: "error",
      });
    } finally {
      setPanelVidBusy(null);
    }
  }

  async function handleSaveDeliverableSnapshot() {
    setSnapshotBusy(true);
    try {
      const { project: updated } = await saveStoryboardDeliverableSnapshot(project.id);
      onProjectChange(updated);
      await onAlert({
        title: "快照已保存",
        message: "交付快照已更新，可点「交付查阅」预览全部图片与视频。",
      });
    } catch (e) {
      await onAlert({
        title: "保存失败",
        message: e instanceof Error ? e.message : "快照保存失败",
        variant: "error",
      });
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function handleMergePanelVideos() {
    setMergeBusy(true);
    try {
      const { assetId, ossUrl } = await mergeStoryboardPanelVideos(project.id);
      onProjectChange({
        ...project,
        videoOssUrl: ossUrl,
        videoAssetId: assetId,
      });
      onVideoReady();
      await onAlert({
        title: "合并完成",
        message: "各镜头视频已拼接为完整成片，并已自动保存交付快照。可点「交付查阅」预览。",
      });
    } catch (e) {
      await onAlert({
        title: "合并失败",
        message: e instanceof Error ? e.message : "视频合并失败",
        variant: "error",
      });
    } finally {
      setMergeBusy(false);
    }
  }

  const panelVideoCount =
    project.sheet?.panels.filter((p) => Boolean(p.videoUrl)).length ?? 0;
  const canMergePanels = panelVideoCount >= 2;

  const canShowGenerate =
    Boolean(project.sheet) ||
    schemes.length > 0 ||
    Boolean(project.meta?.deliverableMarkdown);
  const canGenerateImage = canShowGenerate;
  const canGenerateVideo = hasSheetImages;
  const deliverableSnapshot = project.meta?.deliverableSnapshot;
  const resolvedVideoUrl = (() => {
    const candidates = [
      videoOssUrl,
      project.videoOssUrl,
      deliverableSnapshot?.videoUrl,
    ];
    for (const u of candidates) {
      if (isStoryboardVideoUrl(u)) return u!.trim();
    }
    if (project.videoAssetId) {
      for (const u of candidates) {
        const t = typeof u === "string" ? u.trim() : "";
        if (t && /^https?:\/\//.test(t) && !isStoryboardImageUrl(t)) return t;
      }
    }
    return null;
  })();

  function formatTaskElapsed(startedAt: string | null) {
    if (!startedAt) return "";
    const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StoryboardTaskStatus
        className="mx-6 mb-2"
        active={vidBusy}
        title="整图成片生成中"
        detail={`Gateway 视频任务进行中，通常需 3–8 分钟。${videoTaskStartedAt ? `已等待 ${formatTaskElapsed(videoTaskStartedAt)}` : ""}${videoPollCount > 0 ? ` · 轮询 ${videoPollCount} 次` : ""}。请勿重复提交。`}
      />
      <StoryboardTaskStatus
        className="mx-6 mb-2"
        active={Boolean(imgBusy || regeneratingPanel != null)}
        title={
          regeneratingPanel != null ? `镜头 ${regeneratingPanel} 分镜图生成中` : "分镜图生成中"
        }
        detail="图像任务进行中，可关闭弹层，进度显示于此与对应卡片。"
      />
      <StoryboardTaskStatus
        className="mx-6 mb-2"
        active={mergeBusy}
        title="合并分镜视频中"
        detail="正在拼接各镜头视频为完整成片…"
      />

      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-6">
        {streaming ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-[#0071e3]/10 px-4 py-3 text-sm text-[#0071e3]">
            <Loader2 className="h-4 w-4 animate-spin" />
            助手正在流式输出，完成后将同步显示结构化结果…
          </div>
        ) : null}

        <StoryboardStepResults
          project={project}
          references={references}
          onPreviewImage={(src, title) => setImagePreview({ src, title })}
          onEditScriptPanel={
            project.sheet ? (panelIndex) => setEditPanelIndex(panelIndex) : undefined
          }
          imagesSlot={
            project.sheet ? (
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[#86868b]">各镜头分镜图与单镜视频</p>
                  <EcomButtonSecondary
                    size="sm"
                    type="button"
                    disabled={imgBusy}
                    onClick={() => openImagePicker()}
                  >
                    生成全部分镜图
                  </EcomButtonSecondary>
                </div>
                <div className="flex flex-wrap gap-4">
                  {project.sheet.panels.map((panel) => (
                    <StoryboardPanelCard
                      key={panel.index}
                      panel={panel}
                      aspectRatio={aspectRatio}
                      imageUrl={panel.imageUrl}
                      busy={
                        imgBusy ||
                        regeneratingPanel === panel.index ||
                        panelVidBusy === panel.index
                      }
                      onRegenerateImage={() => openImagePicker(panel.index)}
                      onPreviewImage={
                        panel.imageUrl
                          ? () =>
                              setImagePreview({
                                src: panel.imageUrl!,
                                title: `镜头 ${panel.index}${panel.timeline ? ` · ${panel.timeline}` : ""}`,
                              })
                          : undefined
                      }
                      onEditScript={() => setEditPanelIndex(panel.index)}
                      onRegenerateVideo={() => openVideoPicker({ panelIndex: panel.index })}
                      onPreviewPanelVideo={
                        panel.videoUrl
                          ? () => onPreviewVideo(panel.videoUrl!, `镜头 ${panel.index}`)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ) : undefined
          }
          videoSlot={
            canShowGenerate ? (
              <StoryboardDeliverableSection
                durationSec={durationSec}
                panelVideoCount={panelVideoCount}
                videoAspectRatio={videoAspectRatio}
                panelAspectRatio={aspectRatio}
                sheetPngUrl={project.sheetPngUrl}
                sheet={project.sheet}
                references={references}
                productName={deliverable?.productName}
                productHighlight={
                  project.sheet?.overview.productHighlight ??
                  (typeof deliverable?.params?.卖点 === "string"
                    ? deliverable.params.卖点
                    : typeof deliverable?.params?.["核心卖点"] === "string"
                      ? deliverable.params["核心卖点"]
                      : undefined)
                }
                projectKeywords={pickProjectKeywords()}
                videoUrl={resolvedVideoUrl}
                hasSheetImages={hasSheetImages}
                canMergePanels={canMergePanels}
                vidBusy={vidBusy}
                imageGenBusy={imgBusy || regeneratingPanel != null}
                sheetPngBusy={sheetPngBusy}
                mergeBusy={mergeBusy}
                snapshotBusy={snapshotBusy}
                hasDeliverableSnapshot={Boolean(deliverableSnapshot)}
                onGenerateFullVideo={() => openVideoPicker({ fullSheet: true })}
                onOpenDeliverableReview={() => setDeliverableReviewOpen(true)}
                onSaveSnapshot={() => void handleSaveDeliverableSnapshot()}
                onOpenImagePicker={() => openImagePicker()}
                onOpenSheetPreview={() => setSheetPreviewOpen(true)}
                onReloadProject={handleReloadAndResumeVideo}
                onMergePanelVideos={() => void handleMergePanelVideos()}
                onPreviewVideo={onPreviewVideo}
              />
            ) : undefined
          }
        />
      </div>

      <StoryboardModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode={pickerMode}
        models={pickerMode === "image" ? imageModels : videoModels}
        value={pickerMode === "image" ? imageModel : videoModel}
        panelIndex={pendingPanelIndex}
        videoTarget={pendingVideoTarget}
        aspectRatio={pickerMode === "video" ? videoAspectRatio : aspectRatio}
        onAspectRatioChange={(v) => {
          if (pickerMode === "video") onVideoAspectChange?.(v);
          else if (v !== "1:1") onAspectChange(v);
        }}
        imageSize={imageSize}
        onImageSizeChange={onImageSizeChange}
        durationSec={durationSec}
        onDurationChange={onDurationChange}
        videoResolution={videoResolution}
        onVideoResolutionChange={onVideoResolutionChange}
        panelDurationSec={panelDurationSec}
        onPanelDurationChange={setPanelDurationSec}
        videoR2vRatio={videoR2vRatio}
        onVideoR2vRatioChange={(v) => {
          onVideoR2vRatioChange?.(v);
          const ar = aspectRatioFromR2vRatio(v);
          if (ar) onAspectChange(ar);
        }}
        videoSeed={videoSeed}
        onVideoSeedChange={onVideoSeedChange}
        videoPromptExtend={videoPromptExtend}
        onVideoPromptExtendChange={onVideoPromptExtendChange}
        onChange={(key) => {
          if (pickerMode === "image") onImageModelChange?.(key);
          else onVideoModelChange?.(key);
        }}
        confirming={
          pickerMode === "image"
            ? imgBusy || regeneratingPanel != null
            : vidBusy || panelVidBusy != null
        }
        onConfirm={() => {
          const panelIdx = pendingPanelIndex;
          const mode = pickerMode;
          setPickerOpen(false);
          setPendingPanelIndex(null);
          void (async () => {
            if (mode === "image") {
              await handleGenerateImage(panelIdx ?? undefined);
            } else if (panelIdx != null) {
              await handleGeneratePanelVideo(panelIdx);
            } else {
              await handleGenerateFullVideo();
            }
          })();
        }}
      />

      {deliverableSnapshot ? (
        <StoryboardDeliverableReviewDialog
          open={deliverableReviewOpen}
          onOpenChange={setDeliverableReviewOpen}
          snapshot={deliverableSnapshot}
          onPreviewVideo={onPreviewVideo}
        />
      ) : null}

      {project.sheet ? (
        <StoryboardSheetPreviewDialog
          open={sheetPreviewOpen}
          onOpenChange={setSheetPreviewOpen}
          sheet={project.sheet}
          references={references}
          productName={project.meta?.deliverable?.productName}
          productHighlight={
            project.sheet.overview.productHighlight ??
            (typeof project.meta?.deliverable?.params?.卖点 === "string"
              ? project.meta.deliverable.params.卖点
              : undefined)
          }
          projectKeywords={pickProjectKeywords()}
        />
      ) : null}

      {imagePreview ? (
        <EcomImagePreviewDialog
          src={imagePreview.src}
          title={imagePreview.title}
          open
          onOpenChange={(o) => {
            if (!o) setImagePreview(null);
          }}
        />
      ) : null}

      <StoryboardPanelEditDialog
        open={editPanelIndex != null}
        onOpenChange={(open) => {
          if (!open) setEditPanelIndex(null);
        }}
        panel={
          editPanelIndex != null && project.sheet
            ? project.sheet.panels.find((p) => p.index === editPanelIndex) ?? null
            : null
        }
        onSave={handlePanelSave}
        saving={savingPanel}
      />
    </div>
  );
}
