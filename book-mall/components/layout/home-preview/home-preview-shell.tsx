import { HomePreviewNav } from "@/components/layout/home-preview/home-preview-nav";

export function HomePreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-home-preview className="dark min-h-screen overflow-x-clip">
      <div className="home-preview-page-bg min-h-screen overflow-x-clip">
        <HomePreviewNav />
        {children}
      </div>
    </div>
  );
}
