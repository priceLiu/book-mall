export type AnalysisTemplate =
  | {
      id: string;
      mode: "video";
      title: string;
      description: string;
      videoSrc: string;
      fileName: string;
      prompt: string;
    }
  | {
      id: string;
      mode: "image-send";
      title: string;
      description: string;
      imageSrc: string;
      fileName: string;
      prompt: string;
    };
