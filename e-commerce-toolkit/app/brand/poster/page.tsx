import { PosterStudio } from "@/components/poster/poster-studio";
import { BackgroundGenerationProvider } from "@/components/generation";

export default function BrandPosterPage() {
  return (
    <BackgroundGenerationProvider>
      <PosterStudio />
    </BackgroundGenerationProvider>
  );
}
