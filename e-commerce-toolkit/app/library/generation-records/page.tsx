import { EcomWorkspaceLayout } from "@/components/layout/ecom-workspace-layout";
import {
  EcomGenerationRecordPageHeader,
  EcomGenerationRecordPanel,
  type EcomGenerationRecordFilter,
} from "@/components/library/ecom-generation-record-panel";

function readQueryParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const raw = searchParams?.[key];
  if (typeof raw === "string") return raw.trim() || undefined;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim() || undefined;
  return undefined;
}

function parseGenerationRecordFilter(
  searchParams?: Record<string, string | string[] | undefined>,
): EcomGenerationRecordFilter | undefined {
  const projectId = readQueryParam(searchParams, "projectId");
  if (!projectId) return undefined;
  return {
    projectId,
    sourceModule: readQueryParam(searchParams, "sourceModule"),
    returnTo: readQueryParam(searchParams, "returnTo"),
    projectTitle: readQueryParam(searchParams, "projectTitle"),
  };
}

export default function GenerationRecordsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const filter = parseGenerationRecordFilter(searchParams);
  return (
    <EcomWorkspaceLayout fullWidth>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <EcomGenerationRecordPageHeader filter={filter} />
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <EcomGenerationRecordPanel filter={filter} />
        </div>
      </div>
    </EcomWorkspaceLayout>
  );
}
