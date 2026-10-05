export type AudioAnalysisResult = {
  peaks: number[];
  durationSec: number;
};

const analysisCache = new Map<string, AudioAnalysisResult>();

export function audioAnalysisCacheKey(url: string): string {
  return url.trim();
}

export function getCachedAudioAnalysis(
  url: string,
): AudioAnalysisResult | undefined {
  return analysisCache.get(audioAnalysisCacheKey(url));
}

export function setCachedAudioAnalysis(
  url: string,
  result: AudioAnalysisResult,
): void {
  analysisCache.set(audioAnalysisCacheKey(url), result);
}

/** TTS 重新生成 / URL 变更后清缓存，避免旧波形与时长 */
export function invalidateAudioAnalysisCache(url: string): void {
  const key = audioAnalysisCacheKey(url);
  if (key) analysisCache.delete(key);
}
