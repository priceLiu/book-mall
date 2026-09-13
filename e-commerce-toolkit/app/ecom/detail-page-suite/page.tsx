import { DetailPageSuiteStudio } from "@/components/detail-page-suite/detail-page-suite-studio";
import { BackgroundGenerationProvider } from "@/components/generation";

export const metadata = {
  title: "详情页套图",
};

export default function DetailPageSuitePage() {
  return (
    <BackgroundGenerationProvider>
      <DetailPageSuiteStudio />
    </BackgroundGenerationProvider>
  );
}
