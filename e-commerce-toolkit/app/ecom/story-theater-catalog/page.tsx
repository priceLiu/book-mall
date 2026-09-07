"use client";

import { ArrowLeft } from "lucide-react";

import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import { StoryTheaterCatalogPanel } from "@/components/storyboard/story-theater-catalog-panel";
import { EcomCatalogAdminHint } from "@/components/model-shot/ecom-catalog-admin-hint";
import { EcomIconButtonLink } from "@/components/ui/ecom-icon-button";
import { EcomIconToolbar, EcomIconToolbarGroup } from "@/components/ui/ecom-icon-toolbar";

export default function StoryTheaterCatalogPage() {
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#e8e8ed] bg-white px-4 py-4 sm:px-6 sm:py-5">
          <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-[#1d1d1f]">剧情故事</h1>
              <p className="mt-1 max-w-xl text-sm text-[#6e6e73]">
                故事剧场模式的选题库：系统推荐只读；可在「我的」区自建故事主题，助手选题时会与平台库一起随机抽取。
              </p>
            </div>
            <EcomIconToolbar>
              <EcomIconToolbarGroup label="导航">
                <EcomIconButtonLink
                  label="返回故事版工作室"
                  icon={ArrowLeft}
                  href="/ecom/storyboard"
                />
              </EcomIconToolbarGroup>
            </EcomIconToolbar>
          </div>
        </header>
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <EcomCatalogAdminHint
              adminPath="/admin/templates?tab=ecom&ecom=story-topics"
              adminLabel="故事主题库"
            />
            <StoryTheaterCatalogPanel />
          </div>
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
