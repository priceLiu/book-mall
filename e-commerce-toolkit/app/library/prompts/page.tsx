import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  EcomPromptLibraryPageHeader,
  EcomPromptLibraryPanel,
} from "@/components/library/ecom-prompt-library-panel";

export default function PromptLibraryPage() {
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EcomPromptLibraryPageHeader />
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <EcomPromptLibraryPanel />
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
