"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import {
  CONFIRM_DELETE_GENERIC_SECOND_ZH,
  confirmDestructiveTwice,
} from "@/lib/confirm-destructive-twice";
import {
  clearStoryTheaterLibrary,
  listStoryTheaterLibrary,
  removeStoryTheaterLibrary,
  type StoryTheaterLibraryItem,
} from "@/lib/story-theater-library";

export function StoryTheaterLibraryClient() {
  const [items, setItems] = useState<StoryTheaterLibraryItem[]>([]);

  const reload = useCallback(() => {
    setItems(listStoryTheaterLibrary());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const onRemove = (item: StoryTheaterLibraryItem) => {
    if (
      !confirmDestructiveTwice(
        `从我的剧场删除「${item.title}」？`,
        CONFIRM_DELETE_GENERIC_SECOND_ZH,
      )
    ) {
      return;
    }
    removeStoryTheaterLibrary(item.id);
    reload();
  };

  const onClearAll = () => {
    if (
      !confirmDestructiveTwice(
        "清空我的剧场全部收藏？",
        CONFIRM_DELETE_GENERIC_SECOND_ZH,
      )
    ) {
      return;
    }
    clearStoryTheaterLibrary();
    reload();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <Link href="/story-theater" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← 漫剧剧场首页
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">我的剧场</h1>
          <p className="mt-2 text-sm text-neutral-600">
            收藏的 story-web 空间链接（浏览器 localStorage，仅本机可见）。
          </p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm text-red-600 hover:text-red-800"
          >
            清空全部
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-600">
          暂无收藏。在{" "}
          <Link href="/story-theater/creator" className="font-medium text-neutral-900 underline">
            创作幻想家
          </Link>{" "}
          保存空间链接后会出现在这里。
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{item.title}</p>
                {item.note ? <p className="mt-1 text-sm text-neutral-600">{item.note}</p> : null}
                <p className="mt-1 truncate text-xs text-neutral-400">{item.spaceUrl}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={item.spaceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800"
                >
                  打开 <ExternalLink className="size-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  aria-label={`删除 ${item.title}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
