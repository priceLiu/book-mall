"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Layers, Lock, LockOpen, MapPin, Mic, Palette, Users } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  setStoryProCharacterAssetLocked,
  setStoryProCharacterAudioAssetLocked,
  setStoryProSceneAssetLocked,
  setStoryProStyleProfileLocked,
  type StoryProCharacterAssetRecord,
  type StoryProCharacterAudioAssetRecord,
  type StoryProSceneAssetRecord,
  type StoryProStyleProfileRecord,
} from "@/lib/canvas-api";
import { STORY_PRO_ASSET_REF_KIND_LABELS } from "@/lib/canvas/story-pro-character-asset-catalog";
import { STORY_PRO_SCENE_REF_KIND_LABELS } from "@/lib/canvas/story-pro-scene-asset-catalog";
import {
  notifyStoryProCharacterAssetsChanged,
  useStoryProCharacterAssets,
} from "@/lib/canvas/use-story-pro-character-assets";
import {
  notifyStoryProAudioAssetsChanged,
  useStoryProCharacterAudioAssets,
} from "@/lib/canvas/use-story-pro-audio-assets";
import {
  notifyStoryProSceneAssetsChanged,
  useStoryProSceneAssets,
} from "@/lib/canvas/use-story-pro-scene-assets";
import {
  notifyStoryProStyleProfilesChanged,
  useStoryProStyleProfiles,
} from "@/lib/canvas/use-story-pro-style-profiles";
import { StoryMediaPreviewModal } from "./story-column-media-panel";

export type ProjectAssetTab = "character" | "audio" | "scene" | "style";

export function ProjectAssetsView({
  projectId,
  initialTab = "character",
  compact = false,
}: {
  projectId: string | null | undefined;
  initialTab?: ProjectAssetTab;
  /** 侧栏模式：略紧凑 */
  compact?: boolean;
}) {
  const base = useBookMallBaseUrl();
  const { confirm, doubleConfirm } = useDialogs();
  const { assets: characterAssets, loading: charLoading, refresh: refreshChar } =
    useStoryProCharacterAssets(projectId);
  const { assets: sceneAssets, loading: sceneLoading, refresh: refreshScene } =
    useStoryProSceneAssets(projectId);
  const { profiles: styleProfiles, loading: styleLoading, refresh: refreshStyle } =
    useStoryProStyleProfiles(projectId);
  const { assets: audioAssets, loading: audioLoading, refresh: refreshAudio } =
    useStoryProCharacterAudioAssets(projectId);
  const [tab, setTab] = useState<ProjectAssetTab>(initialTab);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const sortedCharacters = useMemo(
    () =>
      [...characterAssets].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [characterAssets],
  );

  const sortedScenes = useMemo(
    () =>
      [...sceneAssets].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [sceneAssets],
  );

  const sortedStyles = useMemo(
    () =>
      [...styleProfiles].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [styleProfiles],
  );

  const sortedAudio = useMemo(
    () =>
      [...audioAssets].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [audioAssets],
  );

  const toggleCharacterLock = async (asset: StoryProCharacterAssetRecord) => {
    if (!base?.trim()) return;
    const next = !asset.locked;
    const verb = next ? "锁定" : "解锁";
    const ok = next
      ? await doubleConfirm({
          first: {
            title: `${verb}角色资产`,
            message: `${verb}角色资产「${asset.displayName}」？`,
            confirmLabel: "继续",
            cancelLabel: "取消",
          },
          second: {
            title: "确认锁定",
            message:
              "锁定后无法上传、删除或替换该角色的参考图。确定锁定？",
            confirmLabel: "确定锁定",
            cancelLabel: "取消",
          },
        })
      : await confirm({
          title: `${verb}角色资产`,
          message: `${verb}角色资产「${asset.displayName}」？`,
          confirmLabel: verb,
          cancelLabel: "取消",
        });
    if (!ok) return;
    setBusyId(asset.id);
    try {
      await setStoryProCharacterAssetLocked(base, asset.id, next);
      notifyStoryProCharacterAssetsChanged();
      await refreshChar();
    } finally {
      setBusyId(null);
    }
  };

  const toggleSceneLock = async (asset: StoryProSceneAssetRecord) => {
    if (!base?.trim()) return;
    const next = !asset.locked;
    const verb = next ? "锁定" : "解锁";
    const ok = next
      ? await doubleConfirm({
          first: {
            title: `${verb}场景资产`,
            message: `${verb}场景资产「${asset.displayName}」？`,
            confirmLabel: "继续",
            cancelLabel: "取消",
          },
          second: {
            title: "确认锁定",
            message:
              "锁定后无法上传、删除或替换该场景的参考图。确定锁定？",
            confirmLabel: "确定锁定",
            cancelLabel: "取消",
          },
        })
      : await confirm({
          title: `${verb}场景资产`,
          message: `${verb}场景资产「${asset.displayName}」？`,
          confirmLabel: verb,
          cancelLabel: "取消",
        });
    if (!ok) return;
    setBusyId(asset.id);
    try {
      await setStoryProSceneAssetLocked(base, asset.id, next);
      notifyStoryProSceneAssetsChanged();
      await refreshScene();
    } finally {
      setBusyId(null);
    }
  };

  const toggleStyleLock = async (profile: StoryProStyleProfileRecord) => {
    if (!base?.trim()) return;
    const next = !profile.locked;
    const verb = next ? "锁定" : "解锁";
    if (
      !(await confirm({
        title: `${verb}全局风格`,
        message: `${verb}全局风格「${profile.displayName}」？`,
        confirmLabel: verb,
        cancelLabel: "取消",
      }))
    ) {
      return;
    }
    setBusyId(profile.id);
    try {
      await setStoryProStyleProfileLocked(base, profile.id, next);
      notifyStoryProStyleProfilesChanged();
      await refreshStyle();
    } finally {
      setBusyId(null);
    }
  };

  const toggleAudioLock = async (asset: StoryProCharacterAudioAssetRecord) => {
    if (!base?.trim()) return;
    const next = !asset.locked;
    const verb = next ? "锁定" : "解锁";
    if (
      !(await confirm({
        title: `${verb}角色音频`,
        message: `${verb}角色音频「${asset.displayName}」？`,
        confirmLabel: verb,
        cancelLabel: "取消",
      }))
    ) {
      return;
    }
    setBusyId(asset.id);
    try {
      await setStoryProCharacterAudioAssetLocked(base, asset.id, next);
      notifyStoryProAudioAssetsChanged();
      await refreshAudio();
    } finally {
      setBusyId(null);
    }
  };

  const loading =
    tab === "character"
      ? charLoading
      : tab === "scene"
        ? sceneLoading
        : tab === "style"
          ? styleLoading
          : audioLoading;
  const emptyProjectHint = !projectId?.trim();

  return (
    <>
      <div className={compact ? "space-y-2" : "space-y-4"}>
        {!compact ? (
          <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
            四类项目资产：角色视觉 / 角色音频 / 场景·道具 / 全局风格。单槽或整包入库，与画布内面板同步。
            <Link
              href="/guides/project-assets"
              className="ml-1 text-emerald-300/90 underline-offset-2 hover:underline"
            >
              查看使用说明
            </Link>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
              tab === "character"
                ? "bg-emerald-500/20 text-emerald-50"
                : "text-white/60 hover:bg-white/5"
            }`}
            onClick={() => setTab("character")}
          >
            <Users className="size-3" />
            角色视觉
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
              tab === "audio"
                ? "bg-emerald-500/20 text-emerald-50"
                : "text-white/60 hover:bg-white/5"
            }`}
            onClick={() => setTab("audio")}
          >
            <Mic className="size-3" />
            角色音频
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
              tab === "scene"
                ? "bg-emerald-500/20 text-emerald-50"
                : "text-white/60 hover:bg-white/5"
            }`}
            onClick={() => setTab("scene")}
          >
            <MapPin className="size-3" />
            场景/道具
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
              tab === "style"
                ? "bg-emerald-500/20 text-emerald-50"
                : "text-white/60 hover:bg-white/5"
            }`}
            onClick={() => setTab("style")}
          >
            <Palette className="size-3" />
            全局风格
          </button>
          {!compact ? (
            <Link
              href="/guides/project-assets"
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-cyan-200/70 hover:bg-white/5 hover:text-cyan-100"
            >
              <BookOpen className="size-3" />
              使用说明
            </Link>
          ) : null}
        </div>

        {emptyProjectHint ? (
          <p className="text-[12px] text-[var(--canvas-muted)]">
            请先选择或进入一个画布项目；资产按项目隔离存储。
          </p>
        ) : loading ? (
          <p className="text-[12px] text-[var(--canvas-muted)]">加载中…</p>
        ) : tab === "character" ? (
          sortedCharacters.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
              还没有角色资产。在画布「人物设计」列生成三视图后，可通过四槽面板上传脸 / 全身 / 服装 / 三视图。
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedCharacters.map((asset) => (
                <li
                  key={asset.id}
                  className="rounded-lg border border-cyan-400/15 bg-cyan-950/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-cyan-50">
                        {asset.displayName}
                      </p>
                      <p className="text-[10px] text-cyan-200/50">
                        key: {asset.characterKey}
                        {asset.projectId ? " · 本项目" : " · 全局"}
                        {" · v"}
                        {asset.version ?? 1}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                        asset.locked
                          ? "border-amber-400/40 text-amber-200"
                          : "border-white/15 text-white/60 hover:border-cyan-400/30"
                      }`}
                      disabled={busyId === asset.id}
                      onClick={() => void toggleCharacterLock(asset)}
                    >
                      {asset.locked ? (
                        <Lock className="inline size-3" />
                      ) : (
                        <LockOpen className="inline size-3" />
                      )}{" "}
                      {asset.locked ? "已锁" : "锁定"}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {asset.refs.map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        className="group relative size-14 overflow-hidden rounded border border-white/10 bg-black/30"
                        title={
                          ref.label ??
                          STORY_PRO_ASSET_REF_KIND_LABELS[ref.kind]
                        }
                        onClick={() =>
                          setPreview({
                            url: ref.ossUrl,
                            title:
                              ref.label ??
                              `${asset.displayName} · ${STORY_PRO_ASSET_REF_KIND_LABELS[ref.kind]}`,
                          })
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ref.ossUrl}
                          alt=""
                          className="size-full object-contain"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-black/65 px-0.5 py-0.5 text-[8px] text-white/90">
                          {STORY_PRO_ASSET_REF_KIND_LABELS[ref.kind]}
                        </span>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : tab === "scene" ? (
          sortedScenes.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
            还没有场景资产。在画布「场景设计」列生成参考图后，可通过三槽面板保存全景 / 细节 / 氛围。
          </p>
        ) : (
          <ul className="space-y-3">
            {sortedScenes.map((asset) => (
              <li
                key={asset.id}
                className="rounded-lg border border-cyan-400/15 bg-cyan-950/20 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-cyan-50">
                      {asset.displayName}
                    </p>
                    <p className="text-[10px] text-cyan-200/50">
                      key: {asset.sceneKey}
                      {asset.projectId ? " · 本项目" : " · 全局"}
                      {" · v"}
                      {asset.version ?? 1}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                      asset.locked
                        ? "border-amber-400/40 text-amber-200"
                        : "border-white/15 text-white/60 hover:border-cyan-400/30"
                    }`}
                    disabled={busyId === asset.id}
                    onClick={() => void toggleSceneLock(asset)}
                  >
                    {asset.locked ? (
                      <Lock className="inline size-3" />
                    ) : (
                      <LockOpen className="inline size-3" />
                    )}{" "}
                    {asset.locked ? "已锁" : "锁定"}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {asset.refs.map((ref) => (
                    <button
                      key={ref.id}
                      type="button"
                      className="group relative size-14 overflow-hidden rounded border border-white/10 bg-black/30"
                      title={
                        ref.label ??
                        STORY_PRO_SCENE_REF_KIND_LABELS[ref.kind]
                      }
                      onClick={() =>
                        setPreview({
                          url: ref.ossUrl,
                          title:
                            ref.label ??
                            `${asset.displayName} · ${STORY_PRO_SCENE_REF_KIND_LABELS[ref.kind]}`,
                        })
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ref.ossUrl}
                        alt=""
                        className="size-full object-contain"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 px-0.5 py-0.5 text-[8px] text-white/90">
                        {STORY_PRO_SCENE_REF_KIND_LABELS[ref.kind]}
                      </span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )
        ) : tab === "audio" ? (
          sortedAudio.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
              还没有角色音频资产。可通过 API 入库音色样本；后续将在人物列提供绑定入口。
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedAudio.map((asset) => (
                <li
                  key={asset.id}
                  className="rounded-lg border border-emerald-400/15 bg-emerald-950/15 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-emerald-50">
                        {asset.displayName}
                      </p>
                      <p className="text-[10px] text-emerald-200/50">
                        {asset.voiceLabel ?? asset.voiceId ?? asset.characterKey}
                        {asset.projectId ? " · 本项目" : " · 全局"}
                        {" · v"}
                        {asset.version}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                        asset.locked
                          ? "border-amber-400/40 text-amber-200"
                          : "border-white/15 text-white/60"
                      }`}
                      disabled={busyId === asset.id}
                      onClick={() => void toggleAudioLock(asset)}
                    >
                      {asset.locked ? (
                        <Lock className="inline size-3" />
                      ) : (
                        <LockOpen className="inline size-3" />
                      )}{" "}
                      {asset.locked ? "已锁" : "锁定"}
                    </button>
                  </div>
                  {asset.notes ? (
                    <p className="mt-1 line-clamp-2 text-[10px] text-white/55">
                      {asset.notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : tab === "style" ? (
          sortedStyles.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
              还没有全局风格配置。在画布「风格定义」节点填写锚定词后，点击「保存到项目资产（全局风格）」。
            </p>
          ) : (
            <ul className="space-y-3">
              {sortedStyles.map((profile) => (
                <li
                  key={profile.id}
                  className="rounded-lg border border-emerald-400/15 bg-emerald-950/15 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-emerald-50">
                        {profile.displayName}
                      </p>
                      <p className="text-[10px] text-emerald-200/50">
                        {profile.mainStyle ?? "—"} / {profile.colorTone ?? "—"}
                        {profile.projectId ? " · 本项目" : " · 全局"}
                        {" · v"}
                        {profile.version}
                      </p>
                      {profile.anchorZh ? (
                        <p className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-white/60">
                          {profile.anchorZh}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                        profile.locked
                          ? "border-amber-400/40 text-amber-200"
                          : "border-white/15 text-white/60"
                      }`}
                      disabled={busyId === profile.id}
                      onClick={() => void toggleStyleLock(profile)}
                    >
                      {profile.locked ? (
                        <Lock className="inline size-3" />
                      ) : (
                        <LockOpen className="inline size-3" />
                      )}{" "}
                      {profile.locked ? "已锁" : "锁定"}
                    </button>
                  </div>
                  {profile.refImageUrls.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.refImageUrls.map((url) => (
                        <button
                          key={url}
                          type="button"
                          className="size-14 overflow-hidden rounded border border-white/10 bg-black/30"
                          onClick={() =>
                            setPreview({ url, title: profile.displayName })
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="size-full object-contain" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}

export function ProjectAssetsTabBar({
  tab,
  onTab,
}: {
  tab: ProjectAssetTab;
  onTab: (t: ProjectAssetTab) => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
          tab === "character"
            ? "bg-cyan-500/20 text-cyan-50"
            : "text-white/60 hover:bg-white/5"
        }`}
        onClick={() => onTab("character")}
      >
        <Users className="size-3" />
        角色
      </button>
      <button
        type="button"
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
          tab === "scene"
            ? "bg-cyan-500/20 text-cyan-50"
            : "text-white/60 hover:bg-white/5"
        }`}
        onClick={() => onTab("scene")}
      >
        <MapPin className="size-3" />
        场景
      </button>
    </div>
  );
}

export function ProjectAssetsPanelIcon() {
  return <Layers className="size-4 text-cyan-300" />;
}
