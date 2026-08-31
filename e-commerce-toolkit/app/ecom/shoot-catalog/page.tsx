"use client";

import Link from "next/link";

import { ShootCatalogPanel } from "@/components/model-shot/shoot-catalog-panel";
import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";

export default function ShootCatalogPage() {
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#1d1d1f]">姿势 · 场景 · 道具库</h1>
            <p className="mt-1 max-w-xl text-sm text-[#6e6e73]">
              系统推荐条目只读；可在「我的」区自建场景、道具与姿势，供服装模特图姿势表点选。确认计划或出图成功后，被引用的自建条目将锁定。
            </p>
          </div>
          <Link href="/ecom/model-shot">
            <EcomButtonSecondary type="button">返回服装模特图</EcomButtonSecondary>
          </Link>
        </header>
        <ShootCatalogPanel />
      </div>
    </EcomWorkspaceLayout>
  );
}
