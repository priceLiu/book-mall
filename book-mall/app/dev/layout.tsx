import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "本地开发导航",
  robots: { index: false, follow: false },
};

export default function DevHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {children}
    </div>
  );
}
