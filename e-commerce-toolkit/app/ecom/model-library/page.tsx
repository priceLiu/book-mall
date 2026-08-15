"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import { EcomMediaLibraryTile } from "@/components/media/ecom-media-library-tile";
import { EcomScrollLoadFooter } from "@/components/media/ecom-scroll-load-footer";
import { shuffleByIdForDisplay } from "@/lib/ecom-random-order";
import { useEcomScrollPagination } from "@/lib/use-ecom-scroll-pagination";
import { listEcomModelLibraryEntries } from "@/lib/ecom-model-library/catalog";
import { fetchEcomModelLibraryCatalog } from "@/lib/ecom-model-library-api";
import {
  ECOM_MODEL_AGE_LABEL,
  ECOM_MODEL_GENDER_LABEL,
  type EcomModelAge,
  type EcomModelGender,
  type EcomModelLibraryEntry,
} from "@/lib/ecom-model-library/types";

const ALL = "all" as const;

type GenderFilter = typeof ALL | EcomModelGender;
type AgeFilter = typeof ALL | EcomModelAge;

const GENDER_OPTIONS: Array<{ value: GenderFilter; label: string }> = [
  { value: ALL, label: "全部性别" },
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "plus_female", label: "大码女" },
];

const AGE_OPTIONS: Array<{ value: AgeFilter; label: string }> = [
  { value: ALL, label: "全部年龄" },
  { value: "adult", label: "成人" },
  { value: "child", label: "儿童" },
];

const MODEL_LIBRARY_GRID_CLASS =
  "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6";

function filterModels(
  models: EcomModelLibraryEntry[],
  gender: GenderFilter,
  age: AgeFilter,
): EcomModelLibraryEntry[] {
  return models.filter((m) => {
    if (gender !== ALL && m.gender !== gender) return false;
    if (age !== ALL && m.age !== age) return false;
    return true;
  });
}

/** 大码女整体沉底，组内与其余模特一样随机 */
function isPlusFemale(model: EcomModelLibraryEntry): boolean {
  return model.gender === "plus_female";
}

export default function ModelLibraryPage() {
  const [allModels, setAllModels] = useState<EcomModelLibraryEntry[]>(() =>
    listEcomModelLibraryEntries(),
  );
  const [gender, setGender] = useState<GenderFilter>(ALL);
  const [age, setAge] = useState<AgeFilter>(ALL);
  const [preview, setPreview] = useState<{ src: string; title?: string } | null>(
    null,
  );
  /** 0 = 未洗牌，与服务端渲染顺序一致，避免水合不一致 */
  const [shuffleSeed, setShuffleSeed] = useState(0);

  /** 每次进页面 / 换筛选都换一批顺序 */
  const reshuffle = useCallback(() => {
    setShuffleSeed(Math.floor(Math.random() * 0xffffffff) + 1);
  }, []);

  useEffect(() => {
    reshuffle();
  }, [reshuffle]);

  useEffect(() => {
    void fetchEcomModelLibraryCatalog()
      .then((c) => {
        if (c.models.length) setAllModels(c.models);
      })
      .catch(() => {
        /* keep static */
      });
  }, []);

  const models = useMemo(
    () =>
      shuffleByIdForDisplay(
        filterModels(allModels, gender, age),
        shuffleSeed,
        isPlusFemale,
      ),
    [allModels, gender, age, shuffleSeed],
  );

  const {
    scrollRef,
    sentinelRef,
    visibleCount,
    hasMore,
    loadingMore,
    pageSize,
  } = useEcomScrollPagination({
    total: models.length,
    resetKey: `${gender}:${age}:${shuffleSeed}`,
  });

  const visibleModels = useMemo(
    () => models.slice(0, visibleCount),
    [models, visibleCount],
  );

  const empty = allModels.length === 0;
  const loaded = visibleModels.length;

  return (
    <>
      <EcomWorkspaceLayout fullWidth>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[#e8e8ed] px-4 py-4 sm:px-6">
            <div className="space-y-3">
              <div>
                <h1 className="text-lg font-semibold text-[#1d1d1f]">模特库</h1>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  平台内置模特参考图，可按性别与年龄筛选浏览。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 min-w-[120px] rounded-lg border border-[#e8e8ed] bg-white px-3 text-sm text-[#1d1d1f]"
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value as GenderFilter);
                    reshuffle();
                  }}
                  aria-label="性别筛选"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 min-w-[120px] rounded-lg border border-[#e8e8ed] bg-white px-3 text-sm text-[#1d1d1f]"
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value as AgeFilter);
                    reshuffle();
                  }}
                  aria-label="年龄筛选"
                >
                  {AGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-[#6e6e73]">
                {empty
                  ? "暂无模特数据，请先运行导入脚本。"
                  : hasMore
                    ? loadingMore
                      ? `正在加载… ${loaded} / ${models.length} 张（库内共 ${allModels.length} 张）`
                      : `已加载 ${loaded} / ${models.length} 张（库内共 ${allModels.length} 张，滚动加载更多）`
                    : `已显示 ${models.length} / ${allModels.length} 张`}
              </p>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6"
          >
            {empty ? (
              <p className="text-sm text-[#6e6e73]">
                目录为空。请在 book-mall 目录执行{" "}
                <code className="rounded bg-[#f5f5f7] px-1 py-0.5 text-xs">
                  pnpm ecom:import-model-library
                </code>
              </p>
            ) : models.length === 0 ? (
              <p className="text-sm text-[#6e6e73]">当前筛选条件下暂无模特。</p>
            ) : (
              <>
                <ul className={MODEL_LIBRARY_GRID_CLASS}>
                  {visibleModels.map((m) => (
                    <li
                      key={m.id}
                      title={`${m.name} · ${ECOM_MODEL_GENDER_LABEL[m.gender]} · ${ECOM_MODEL_AGE_LABEL[m.age]}`}
                    >
                      <EcomMediaLibraryTile
                        kind="image"
                        src={m.ossUrl}
                        alt={m.name}
                        onPreview={() => setPreview({ src: m.ossUrl, title: m.name })}
                      />
                    </li>
                  ))}
                </ul>
                <EcomScrollLoadFooter
                  sentinelRef={sentinelRef}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  gridClass={MODEL_LIBRARY_GRID_CLASS}
                  skeletonCount={Math.min(pageSize, models.length - loaded)}
                />
              </>
            )}
          </div>
        </div>
      </EcomWorkspaceLayout>

      {preview ? (
        <EcomImagePreviewDialog
          src={preview.src}
          title={preview.title}
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
        />
      ) : null}
    </>
  );
}
