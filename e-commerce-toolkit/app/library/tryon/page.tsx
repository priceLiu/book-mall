"use client";

import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  VtonTryonLibraryPageHeader,
  VtonTryonLibraryPanel,
} from "@/components/vton/vton-tryon-library-panel";

export default function TryonLibraryPage() {
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <VtonTryonLibraryPageHeader />
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <VtonTryonLibraryPanel />
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
