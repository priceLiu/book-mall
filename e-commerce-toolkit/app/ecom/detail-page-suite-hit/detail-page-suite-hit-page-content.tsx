"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { ProductCreationStudioSkeleton } from "@/components/product-design/product-creation-studio-skeleton";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";

const DetailPageSuiteHitStudio = dynamic(
  () =>
    import("@/components/detail-page-suite/detail-page-suite-hit-studio").then(
      (mod) => mod.DetailPageSuiteHitStudio,
    ),
  {
    loading: () => <ProductCreationStudioSkeleton />,
    ssr: false,
  },
);

export function DetailPageSuiteHitPageContent() {
  const [chunkFailed, setChunkFailed] = useState(false);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = `${event.message ?? ""} ${event.error?.message ?? ""}`;
      if (/ChunkLoadError|Loading chunk .* failed/i.test(msg)) {
        setChunkFailed(true);
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? "");
      if (/ChunkLoadError|Loading chunk .* failed/i.test(msg)) {
        setChunkFailed(true);
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (chunkFailed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-[#515154]">
          工作台脚本加载超时（开发环境首次编译较慢）。请刷新重试；若刚改过代码，请先重启
          e-commerce-toolkit 再打开本页。
        </p>
        <EcomButtonPrimary type="button" onClick={() => window.location.reload()}>
          刷新页面
        </EcomButtonPrimary>
      </div>
    );
  }

  return <DetailPageSuiteHitStudio />;
}
