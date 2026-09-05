/** 与 book-mall `FILM_PULL_V1_MAX_SEC` 保持一致 */
export const FILM_PULL_MAX_VIDEO_SEC = 90;

export function filmPullMaxVideoSecLabel(): string {
  return `≤${FILM_PULL_MAX_VIDEO_SEC}s`;
}
