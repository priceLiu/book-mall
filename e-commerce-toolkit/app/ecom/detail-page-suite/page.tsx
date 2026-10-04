import { DetailPageSuiteStudio } from "@/components/detail-page-suite/detail-page-suite-studio";
import { BackgroundGenerationProvider } from "@/components/generation";

export const metadata = {
  title: "服装详情套图（模板）",
};

export default function DetailPageSuitePage() {
  return (
    <BackgroundGenerationProvider>
      <DetailPageSuiteStudio />
    </BackgroundGenerationProvider>
  );
}
