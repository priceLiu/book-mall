import { CanvasHubLayoutShell } from "@/components/layout/canvas-hub-layout-shell";

export default function CanvasHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CanvasHubLayoutShell>{children}</CanvasHubLayoutShell>;
}