import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "应用历史 — AI 工具站",
};

export default function AppHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
