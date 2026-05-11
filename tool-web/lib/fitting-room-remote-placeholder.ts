/** CDN / 同源代理均失败时的占位图（picsum 按 seed 稳定，便于列表先有可视内容）。 */
export function fittingRoomRemotePlaceholderSrc(seed: string): string {
  const safe = encodeURIComponent(seed.slice(0, 96));
  return `https://picsum.photos/seed/${safe}/400/533`;
}
