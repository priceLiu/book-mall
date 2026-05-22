"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  AspectRatioPreview,
  StylePickerGrid,
} from "@/components/projects/style-picker-grid";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { apiCreateProject, BookMallApiError } from "@/lib/projects/api";
import type { AspectRatio } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

const inputClassName =
  "w-full rounded-lg border border-white/20 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--story-muted)] focus:border-[var(--story-accent)] focus:ring-1 focus:ring-[var(--story-accent)]";

function CreateProjectFormInner() {
  const router = useRouter();
  const base = useBookMallBaseUrl();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [styleId, setStyleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("请填写项目名称");
      nameInputRef.current?.focus();
      return;
    }
    if (!description.trim()) {
      setError("请填写故事描述");
      return;
    }
    if (!styleId) {
      setError("请选择风格");
      return;
    }
    if (!base) {
      setError("Book mall 地址未配置，无法新建。");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const project = await apiCreateProject(base, {
        name: name.trim(),
        description: description.trim(),
        aspectRatio,
        styleId,
      });
      router.push(`/project/${project.id}`);
    } catch (e) {
      const msg =
        e instanceof BookMallApiError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "创建失败";
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="story-container py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[980px]">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--story-muted)] transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          返回项目列表
        </Link>

        <header className="mt-6 border-b border-white/10 pb-6">
          <p className="twenty-eyebrow">New Project</p>
          <h1 className="story-serif mt-2 text-3xl text-white sm:text-4xl">
            新建漫剧项目
          </h1>
          <p className="twenty-body mt-2">
            填写项目信息并选择风格，创建后进入故事设定与分镜流程。
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <section className="space-y-5 rounded-2xl border border-white/10 bg-[var(--story-surface)] p-5 sm:p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white">
                项目名称 <span className="text-red-400">*</span>
              </span>
              <input
                ref={nameInputRef}
                type="text"
                name="projectName"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：星尘旅人"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white">
                故事描述 <span className="text-red-400">*</span>
              </span>
              <textarea
                name="projectDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="简述故事背景、主角与核心冲突…"
                className={cn(inputClassName, "resize-none")}
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium text-white">
                画幅比
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {(["16:9", "9:16"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={cn(
                      "rounded-lg border px-5 py-2 text-sm transition",
                      aspectRatio === ratio
                        ? "border-white bg-white text-black"
                        : "border-white/15 text-white hover:bg-white/5",
                    )}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <AspectRatioPreview aspectRatio={aspectRatio} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[var(--story-surface)] p-5 sm:p-6">
            <span className="mb-4 block text-sm font-medium text-white">
              风格选择
            </span>
            <StylePickerGrid
              value={styleId}
              aspectRatio={aspectRatio}
              onChange={setStyleId}
            />
          </section>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-6">
            <Link
              href="/projects"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white hover:bg-white/5"
            >
              取消
            </Link>
            <button type="submit" className="twenty-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  创建中…
                </>
              ) : (
                "创建并进入"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateProjectForm() {
  return (
    <RequireAuth>
      <CreateProjectFormInner />
    </RequireAuth>
  );
}
