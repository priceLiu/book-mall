"use client";

import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  VtonModelLibraryPageHeader,
  VtonModelLibraryPanel,
} from "@/components/vton/vton-model-library-panel";

export default function ModelLibraryPage() {
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <VtonModelLibraryPageHeader />
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <VtonModelLibraryPanel />
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
