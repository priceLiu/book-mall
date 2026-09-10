"use client";

import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  EcomGenerationRecordPageHeader,
  EcomGenerationRecordPanel,
} from "@/components/library/ecom-generation-record-panel";

export default function GenerationRecordsPage() {
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EcomGenerationRecordPageHeader />
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <EcomGenerationRecordPanel />
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
