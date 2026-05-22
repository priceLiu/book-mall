"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Pencil, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { DestructiveConfirmModal } from "@/components/common/destructive-confirm-modal";
import { PromptEditModal } from "@/components/project-workspace/prompt-edit-modal";
import { MediaPlaceholder } from "@/components/project-workspace/media-placeholder";
import { MediaHoverActions } from "@/components/project-workspace/media-hover-actions";
import { MediaLightbox } from "@/components/project-workspace/media-lightbox";
import { CharacterEditModal } from "@/components/project-workspace/character-edit-modal";
import {
  apiDeleteCharacter,
  apiInitializeProject,
  apiPatchCharacter,
  apiPatchProject,
  apiRegenerateAvatar,
  apiRegenerateCover,
  BookMallApiError,
  STORY_CHARACTER_COUNT_OPTIONS,
  type StoryCharacterCount,
} from "@/lib/projects/api";
import { getComicStyleById } from "@/lib/comic-styles";
import type { ComicProject, ProjectCharacter } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type AvatarPromptTarget = {
  characterId: string;
  name: string;
  imagePrompt: string;
  hasAvatar: boolean;
  avatarInflight: boolean;
};

function mediaAspectClass(aspectRatio: ComicProject["aspectRatio"]): string {
  return aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video";
}

type Props = {
  project: ComicProject;
  onProjectChange: (project: ComicProject) => void;
  reload: () => Promise<void>;
};

export function StorySetupTab({ project, onProjectChange, reload }: Props) {
  const base = useBookMallBaseUrl();
  const style = getComicStyleById(project.styleId);
  const aspectClass = mediaAspectClass(project.aspectRatio);

  const [initializing, setInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [characterCount, setCharacterCount] = useState<StoryCharacterCount>(5);
  const [retryingCover, setRetryingCover] = useState(false);
  const [retryingAvatarId, setRetryingAvatarId] = useState<string | null>(null);
  const [confirmDeleteCharacter, setConfirmDeleteCharacter] =
    useState<ProjectCharacter | null>(null);
  const [outlineModalOpen, setOutlineModalOpen] = useState(false);
  const [avatarPromptTarget, setAvatarPromptTarget] =
    useState<AvatarPromptTarget | null>(null);
  const [editingCharacter, setEditingCharacter] =
    useState<ProjectCharacter | null>(null);
  const [lightbox, setLightbox] = useState<{
    kind: "image";
    src: string;
    caption: string;
    alt?: string;
  } | null>(null);

  const isUninitialized = !project.storyOutline.trim();

  const coverPending = project.pendingTasks.some(
    (t) =>
      t.kind === "COVER_IMAGE" &&
      (t.status === "PENDING" || t.status === "SUBMITTED"),
  );
  const coverFailedTask = project.pendingTasks.find(
    (t) => t.kind === "COVER_IMAGE" && t.status === "FAILED",
  );
  const coverFailed = !!coverFailedTask;
  const failedAvatarTaskByCharId = new Map(
    project.pendingTasks
      .filter(
        (t) =>
          t.kind === "CHARACTER_AVATAR" &&
          t.status === "FAILED" &&
          t.characterId,
      )
      .map((t) => [t.characterId as string, t] as const),
  );

  const handleRetryCover = async () => {
    if (!base) return;
    setRetryingCover(true);
    try {
      await apiRegenerateCover(base, project.id);
    } catch (e) {
      console.warn("retry cover failed", e);
    } finally {
      setRetryingCover(false);
      void reload();
    }
  };

  const handleRetryAvatar = async (characterId: string) => {
    if (!base) return;
    setRetryingAvatarId(characterId);
    try {
      await apiRegenerateAvatar(base, project.id, characterId);
    } catch (e) {
      console.warn("retry avatar failed", e);
    } finally {
      setRetryingAvatarId(null);
      void reload();
    }
  };

  const handleInitialize = async () => {
    if (!base) {
      setInitError("Book mall 地址未配置。");
      return;
    }
    setInitializing(true);
    setInitError(null);
    try {
      const result = await apiInitializeProject(base, project.id, {
        characterCount,
      });
      onProjectChange({
        ...result.project,
        characters: result.project.characters,
        storyboardFrames: result.project.frames,
        pendingTasks: result.project.pendingTasks,
      });
    } catch (e) {
      const code = e instanceof BookMallApiError ? e.code : "UNKNOWN";
      const msg =
        e instanceof BookMallApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "初始化失败";
      setInitError(`${code}: ${msg}`);
      // 即便失败也刷一次，避免 LLM 已生成大纲但未走完角色那一步
      void reload();
    } finally {
      setInitializing(false);
    }
  };

  if (isUninitialized) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-[var(--story-surface)]/30 px-6 py-16 text-center">
        <div className="mx-auto max-w-md">
          <Sparkles className="mx-auto size-7 text-white/85" />
          <h2 className="mt-3 text-xl font-medium text-white">
            一键初始化故事
          </h2>
          <p className="mt-2 text-sm text-[var(--story-muted)]">
            AI 将依据你填写的项目描述，生成故事大纲与角色，并提交封面图与角色头像的生成任务。
          </p>

          <div className="mt-6">
            <p className="mb-2 text-xs text-[var(--story-muted)]">
              希望生成多少个角色？
            </p>
            <div
              className="inline-flex overflow-hidden rounded-full border border-white/15 bg-black/30"
              role="radiogroup"
              aria-label="角色数量"
            >
              {STORY_CHARACTER_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={characterCount === n}
                  onClick={() => setCharacterCount(n)}
                  disabled={initializing}
                  className={cn(
                    "px-4 py-1.5 text-sm transition",
                    characterCount === n
                      ? "bg-white text-black"
                      : "text-white/85 hover:bg-white/5",
                  )}
                >
                  {n} 个
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={initializing}
            onClick={() => void handleInitialize()}
            className="twenty-btn mt-6 disabled:opacity-60"
          >
            {initializing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                AI 生成中…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                一键初始化故事
              </>
            )}
          </button>
          {initError ? (
            <p className="mt-3 text-[11px] text-red-300">{initError}</p>
          ) : (
            <p className="mt-3 text-[11px] text-[var(--story-muted)]">
              本步骤约 30~60 秒；将先生成大纲，再生成 {characterCount} 个角色。
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--story-surface)]/40 p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(180px,240px)_1fr] lg:items-stretch">
        <section className="flex flex-col">
          <h2 className="mb-3 text-sm font-medium text-white">封面图</h2>
          <div
            className={cn(
              "group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40",
              aspectClass,
            )}
          >
            <MediaHoverActions
              kind="image"
              hasPreview={!!project.coverImageUrl}
              onPreview={() => {
                if (!project.coverImageUrl) return;
                setLightbox({
                  kind: "image",
                  src: project.coverImageUrl,
                  caption: `${project.name} · 封面`,
                  alt: `${project.name} 封面`,
                });
              }}
              previewLabel="全屏预览封面"
            />
            {project.coverImageUrl ? (
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    kind: "image",
                    src: project.coverImageUrl,
                    caption: `${project.name} · 封面`,
                    alt: `${project.name} 封面`,
                  })
                }
                className="absolute inset-0 cursor-zoom-in"
                aria-label="全屏预览封面"
              />
            ) : null}
            {project.coverImageUrl ? (
              <Image
                src={project.coverImageUrl}
                alt={`${project.name} 封面`}
                fill
                sizes="240px"
                className="pointer-events-none object-cover"
                unoptimized
              />
            ) : (
              <MediaPlaceholder
                fallbackUrl={project.styleFallbackUrl}
                state={
                  retryingCover || coverPending
                    ? "loading"
                    : coverFailed
                      ? "failed"
                      : "empty"
                }
                loadingLabel="封面生成中…"
                failedReason={coverFailedTask?.failMessage ?? null}
                failedCode={coverFailedTask?.failCode ?? null}
              />
            )}
          </div>
          {style ? (
            <p className="mt-2 text-xs text-[var(--story-muted)]">
              {style.name_cn} · {project.aspectRatio}
            </p>
          ) : null}
          {project.coverImageUrl ? (
            <button
              type="button"
              onClick={() => void handleRetryCover()}
              disabled={retryingCover}
              className="mt-2 inline-flex items-center gap-1.5 self-start rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-white/85 transition hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCcw className={cn("size-3", retryingCover && "animate-spin")} />
              重新生成封面
            </button>
          ) : null}
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-white">故事大纲</h2>
            <button
              type="button"
              onClick={() => setOutlineModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-white/85 transition hover:bg-white/5"
            >
              <Pencil className="size-3" />
              编辑
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOutlineModalOpen(true)}
            className="min-h-[200px] max-h-[42vh] flex-1 cursor-text overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-white/25 sm:p-5 lg:min-h-0"
            title="点击编辑故事大纲"
          >
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[var(--story-muted)]">
              {project.storyOutline}
            </pre>
          </button>
        </section>
      </div>

      <section className="mt-6 border-t border-white/10 pt-6">
        <h2 className="mb-3 text-sm font-medium text-white">
          故事角色
          {project.characters.length > 0 ? (
            <span className="ml-2 text-xs text-[var(--story-muted)]">
              共 {project.characters.length} 个
            </span>
          ) : null}
        </h2>
        {project.characters.length === 0 ? (
          <p className="text-sm text-[var(--story-muted)]">
            尚未生成角色。
          </p>
        ) : (
          <ul
            className={cn(
              "grid gap-3",
              // 数量自适应：3 → 3 列；5 → 5 列（lg+）；8 → 8 列（xl+）
              project.characters.length <= 3
                ? "grid-cols-2 sm:grid-cols-3"
                : project.characters.length <= 5
                  ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
                  : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
            )}
          >
            {project.characters.map((character) => {
              const avatarInflight =
                character.avatarTaskStatus === "PENDING" ||
                character.avatarTaskStatus === "SUBMITTED";
              return (
              <li key={character.id} className="min-w-0">
                <div
                  className={cn(
                    "group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 transition hover:border-white/25",
                    aspectClass,
                  )}
                >
                  <MediaHoverActions
                    kind="image"
                    hasPreview={!!character.avatarUrl}
                    onEdit={() =>
                      setAvatarPromptTarget({
                        characterId: character.id,
                        name: character.name,
                        imagePrompt: character.imagePrompt,
                        hasAvatar: !!character.avatarUrl,
                        avatarInflight,
                      })
                    }
                    onPreview={() => {
                      if (!character.avatarUrl) return;
                      setLightbox({
                        kind: "image",
                        src: character.avatarUrl,
                        caption: `${character.name} · ${character.role || "角色头像"}`,
                        alt: character.name,
                      });
                    }}
                    editLabel="编辑头像提示词"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (character.avatarUrl) {
                        setLightbox({
                          kind: "image",
                          src: character.avatarUrl,
                          caption: `${character.name} · ${character.role || "角色头像"}`,
                          alt: character.name,
                        });
                      } else {
                        setAvatarPromptTarget({
                          characterId: character.id,
                          name: character.name,
                          imagePrompt: character.imagePrompt,
                          hasAvatar: false,
                          avatarInflight,
                        });
                      }
                    }}
                    className="absolute inset-0 cursor-pointer"
                    aria-label={
                      character.avatarUrl
                        ? "全屏预览角色头像"
                        : "编辑头像提示词"
                    }
                  />
                  {character.avatarUrl ? (
                    <Image
                      src={character.avatarUrl}
                      alt={character.name}
                      fill
                      sizes="160px"
                      className="pointer-events-none object-cover"
                      unoptimized
                    />
                  ) : (
                    <MediaPlaceholder
                      fallbackUrl={project.styleFallbackUrl}
                      state={
                        avatarInflight
                          ? "loading"
                          : character.avatarTaskStatus === "FAILED"
                            ? "failed"
                            : "empty"
                      }
                      loadingLabel="头像生成中"
                      failedReason={
                        failedAvatarTaskByCharId.get(character.id)
                          ?.failMessage ?? null
                      }
                      failedCode={
                        failedAvatarTaskByCharId.get(character.id)
                          ?.failCode ?? null
                      }
                    />
                  )}
                </div>
                <div className="mt-2 px-0.5">
                  <p className="truncate text-sm font-medium text-white">
                    {character.name}
                  </p>
                  <p className="truncate text-xs text-[var(--story-muted)]">
                    {character.role}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingCharacter(character)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 text-[10px] text-white/85 transition hover:bg-white/5"
                    >
                      <Pencil className="size-3" />
                      编辑信息
                    </button>
                    {(character.avatarTaskStatus === "FAILED" ||
                      !character.avatarUrl) &&
                    character.avatarTaskStatus !== "PENDING" &&
                    character.avatarTaskStatus !== "SUBMITTED" ? (
                      <button
                        type="button"
                        onClick={() => void handleRetryAvatar(character.id)}
                        disabled={retryingAvatarId === character.id}
                        className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 text-[10px] text-white/85 transition hover:bg-white/5 disabled:opacity-60"
                      >
                        <RefreshCcw
                          className={cn(
                            "size-3",
                            retryingAvatarId === character.id && "animate-spin",
                          )}
                        />
                        重新生成
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCharacter(character)}
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 text-[10px] text-white/70 transition hover:border-red-400/60 hover:text-red-300"
                    >
                      <Trash2 className="size-3" />
                      删除角色
                    </button>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <DestructiveConfirmModal
        open={!!confirmDeleteCharacter}
        content={{
          step1Title: `删除角色「${confirmDeleteCharacter?.name ?? ""}」`,
          step1Body: (
            <>
              <p>将从故事中移除此角色。</p>
              <p className="text-xs text-[var(--story-muted)]">
                身份：{confirmDeleteCharacter?.role || "—"}
              </p>
            </>
          ),
          step2Title: "确认删除？此操作不可恢复",
          step2Body: (
            <>
              <p className="text-red-300">删除后不可恢复。</p>
              <p className="text-sm text-white/85">
                角色头像（云端存储 OSS）将一并清理；所有分镜中对该角色的引用会被解除。
              </p>
            </>
          ),
        }}
        onCancel={() => setConfirmDeleteCharacter(null)}
        onConfirm={async () => {
          if (!base || !confirmDeleteCharacter) return;
          try {
            await apiDeleteCharacter(
              base,
              project.id,
              confirmDeleteCharacter.id,
            );
          } catch (e) {
            console.warn("delete character failed", e);
          }
          setConfirmDeleteCharacter(null);
          void reload();
        }}
      />

      <PromptEditModal
        open={outlineModalOpen}
        title="编辑故事大纲"
        fieldLabel="故事大纲（保存后可在「分镜设定」点击「重新生成全部分镜」让 AI 按新大纲重写分镜）"
        value={project.storyOutline}
        rows={16}
        maxWidthClass="max-w-4xl"
        onClose={() => setOutlineModalOpen(false)}
        onSave={async (val) => {
          if (!base) throw new Error("Book mall 地址未配置。");
          try {
            await apiPatchProject(base, project.id, { storyOutline: val });
          } catch (e) {
            if (e instanceof BookMallApiError) {
              throw new Error(`${e.code}: ${e.message}`);
            }
            throw e;
          }
          void reload();
        }}
      />

      <CharacterEditModal
        open={!!editingCharacter}
        character={editingCharacter}
        onClose={() => setEditingCharacter(null)}
        onSave={async (patch) => {
          if (!editingCharacter) return;
          if (!base) throw new Error("Book mall 地址未配置。");
          try {
            await apiPatchCharacter(
              base,
              project.id,
              editingCharacter.id,
              patch,
            );
          } catch (e) {
            if (e instanceof BookMallApiError) {
              throw new Error(`${e.code}: ${e.message}`);
            }
            throw e;
          }
          void reload();
        }}
      />

      <PromptEditModal
        open={!!avatarPromptTarget}
        title={
          avatarPromptTarget
            ? `${avatarPromptTarget.name} · 头像提示词`
            : ""
        }
        value={avatarPromptTarget?.imagePrompt ?? ""}
        rows={8}
        onClose={() => setAvatarPromptTarget(null)}
        onSave={async (val) => {
          if (!avatarPromptTarget) return;
          if (!base) throw new Error("Book mall 地址未配置。");
          const target = avatarPromptTarget;
          try {
            await apiPatchCharacter(base, project.id, target.characterId, {
              imagePrompt: val,
            });
          } catch (e) {
            if (e instanceof BookMallApiError) {
              throw new Error(`${e.code}: ${e.message}`);
            }
            throw e;
          }
          void reload();
        }}
        extraSubmit={
          avatarPromptTarget
            ? {
                label: avatarPromptTarget.hasAvatar
                  ? "保存并重新生成头像"
                  : "保存并生成头像",
                savingLabel: "提交中…",
                successLabel: "已提交生成",
                disabled: avatarPromptTarget.avatarInflight,
                disabledTitle: avatarPromptTarget.avatarInflight
                  ? "正在生成中…"
                  : undefined,
                onClick: async (val) => {
                  if (!avatarPromptTarget) return;
                  if (!base) throw new Error("Book mall 地址未配置。");
                  const target = avatarPromptTarget;
                  try {
                    await apiPatchCharacter(
                      base,
                      project.id,
                      target.characterId,
                      { imagePrompt: val },
                    );
                    await apiRegenerateAvatar(
                      base,
                      project.id,
                      target.characterId,
                    );
                  } catch (e) {
                    if (e instanceof BookMallApiError) {
                      throw new Error(`${e.code}: ${e.message}`);
                    }
                    throw e;
                  }
                  void reload();
                },
              }
            : undefined
        }
      />

      <MediaLightbox
        open={!!lightbox}
        kind={lightbox?.kind ?? "image"}
        src={lightbox?.src}
        alt={lightbox?.alt}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
