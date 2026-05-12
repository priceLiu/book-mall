import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "费用使用明细 — AI 工具站",
};

export default function AppHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
