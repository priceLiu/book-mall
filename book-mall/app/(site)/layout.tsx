import { Navbar } from "@/components/layout/navbar";

/** 构建阶段 CI 往往无 DATABASE_URL；避免对 Prisma 做静态预渲染 */
export const dynamic = "force-dynamic";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="pt-4 md:pt-5">{children}</div>
    </>
  );
}
