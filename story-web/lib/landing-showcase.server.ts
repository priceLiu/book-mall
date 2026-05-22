import fs from "fs";
import path from "path";
import {
  HOT_COMIC_COVERS,
  getDefaultLandingShowcase,
  getMockDiscoverVideos,
  type DiscoverVideoItem,
  type LandingShowcase,
} from "./landing-showcase";

function readPublicDir(subdir: string): string[] {
  const dir = path.join(process.cwd(), "public", subdir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getDiscoverVideosFromDisk(): DiscoverVideoItem[] | null {
  const files = readPublicDir("video").filter((name) =>
    /\.(mp4|webm|mov)$/i.test(name),
  );
  if (files.length === 0) return null;

  return files.map((file, index) => {
    const base = file.replace(/\.[^.]+$/, "");
    const cover = HOT_COMIC_COVERS[index % HOT_COMIC_COVERS.length];
    return {
      id: base,
      src: `/video/${file}`,
      playbackSrc: `/video/${file}`,
      title: cover?.title ?? base,
      author: "社区创作者",
      poster: cover?.src,
    };
  });
}

/** 服务端读取 public/video；无文件时使用模拟数据 */
export function getLandingShowcase(): LandingShowcase {
  const fromDisk = getDiscoverVideosFromDisk();
  if (!fromDisk) {
    return getDefaultLandingShowcase();
  }
  return {
    covers: HOT_COMIC_COVERS,
    videos: fromDisk,
  };
}

export { getMockDiscoverVideos };
