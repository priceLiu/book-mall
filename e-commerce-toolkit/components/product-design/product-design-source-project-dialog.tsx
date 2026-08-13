"use client";

import Image from "next/image";
import { Check, ImageOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { listProductDesignProjects } from "@/lib/ecom-product-design-api";
import type {
  EcomPlatformSpec,
  ProductDesignProjectSummary,
  ProductDesignStrategyImport,
} from "@/lib/product-design-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specs: EcomPlatformSpec[];
  onConfirm: (input: ProductDesignStrategyImport) => void | Promise<void>;
};

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * 详情页入口专用：挑一个已有主图项目，把 Step0–3 策略与产品图快照搬过来。
 * 选的是「项目」而非资产图，因此不能复用 EcomAssetPickerDialog。
 */
export function ProductDesignSourceProjectDialog({
  open,
  onOpenChange,
  specs,
  onConfirm,
}: Props) {
  const [projects, setProjects] = useState<ProductDesignProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [productRefs, setProductRefs] = useState(true);
  const [mainImagesAsStyleRefs, setMainImagesAsStyleRefs] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listProductDesignProjects("main-image", { detailed: true })
      .then((items) => {
        if (!cancelled) setProjects(items);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const selectedMainImageCount = selected?.mainImageCount ?? 0;

  async function handleConfirm() {
    if (!selected) return;
    setConfirming(true);
    try {
      await onConfirm({
        projectId: selected.id,
        productRefs,
        mainImagesAsStyleRefs: mainImagesAsStyleRefs && selectedMainImageCount > 0,
      });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-[#f0f0f2] px-5 py-4">
          <DialogTitle className="text-[15px]">从已有主图项目导入</DialogTitle>
          <p className="text-[12px] text-[#86868b]">
            导入信息采集、平台拆解、营销方案与购买理由（Step0–3），导入后仍可在中间工作区修改。
          </p>
        </DialogHeader>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="grid place-items-center gap-2 py-14 text-sm text-[#86868b]">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在加载主图项目…
            </div>
          ) : error ? (
            <p className="py-14 text-center text-sm text-[#c0392b]">{error}</p>
          ) : projects.length === 0 ? (
            <p className="py-14 text-center text-sm text-[#86868b]">
              还没有主图项目。可以先去「电商产品主图创作」做一个，或直接从头开始做详情页。
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map((p) => {
                const active = p.id === selectedId;
                const platform =
                  specs.find((s) => s.code === p.platform)?.label ?? p.platform;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-colors",
                      active
                        ? "border-[#0071e3] bg-[#f0f6ff]"
                        : "border-[#e8e8ed] bg-white hover:border-[#d2d2d7]",
                    )}
                  >
                    <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f5f7]">
                      {p.thumbnailUrl ? (
                        <Image
                          src={p.thumbnailUrl}
                          alt={p.productName ?? "产品图"}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <ImageOff className="h-4 w-4 text-[#c7c7cc]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[#1d1d1f]">
                        {p.productName ?? p.title ?? "未命名项目"}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[#86868b]">
                        {platform} · 主图 {p.mainImageCount ?? 0} 张 ·{" "}
                        {formatUpdatedAt(p.updatedAt)}
                      </span>
                      {!p.strategyReady ? (
                        <span className="mt-0.5 block text-[11px] text-[#c0392b]">
                          Step0–3 尚未完成，导入后需补齐缺失内容
                        </span>
                      ) : null}
                    </span>
                    {active ? (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected ? (
          <div className="flex flex-col gap-2 border-t border-[#f0f0f2] px-5 py-3">
            <label className="flex items-center gap-2 text-[12px] text-[#1d1d1f]">
              <input
                type="checkbox"
                checked={productRefs}
                onChange={(e) => setProductRefs(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#0071e3]"
              />
              一并导入产品图
            </label>
            <label
              className={cn(
                "flex items-center gap-2 text-[12px]",
                selectedMainImageCount > 0 ? "text-[#1d1d1f]" : "text-[#c7c7cc]",
              )}
            >
              <input
                type="checkbox"
                checked={mainImagesAsStyleRefs && selectedMainImageCount > 0}
                disabled={selectedMainImageCount === 0}
                onChange={(e) => setMainImagesAsStyleRefs(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#0071e3]"
              />
              用主图成品作为详情页风格参考（最多 3 张）
            </label>
          </div>
        ) : null}

        <DialogFooter className="border-t border-[#f0f0f2] px-5 py-3">
          <EcomButtonSecondary size="sm" type="button" onClick={() => onOpenChange(false)}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={!selected || confirming}
            onClick={() => void handleConfirm()}
          >
            {confirming ? "正在导入…" : "导入并新建详情页项目"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
