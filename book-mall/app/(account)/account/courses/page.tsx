import { AccountSectionHeader } from "@/components/account/account-section-header";
import { CoursesCatalog } from "@/components/courses/courses-catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 学堂 — 个人中心",
  description: "会员课程目录与学习入口。",
};

export default function AccountCoursesPage() {
  return (
    <>
      <AccountSectionHeader
        title="AI 学堂"
        description="已上架课程列表；进入课程页学习须具备有效会员订阅。"
      />
      <CoursesCatalog embedded />
    </>
  );
}
