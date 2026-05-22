import fs from "fs";
import path from "path";
import {
  HOT_COMIC_COVERS,
  getDefaultLandingShowcase,
  getMockDiscoverVideos,
  type DiscoverVideoItem,
  type LandingShowcase,
} from "./landing-showcase";

type LandingVideosManifest = {
  videos: { id: string; file: string; url: string }[];
};

const MANIFEST_PATH = path.join(
  process.cwd(),
  "src",
  "shared",
  "landing-videos.manifest.json",
);

function readPublicDir(subdir: string): string[] {
  const dir = path.join(process.cwd(), "public", subdir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function loadManifest(): LandingVideosManifest | null {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
    return JSON.parse(raw) as LandingVideosManifest;
  } catch {
    return null;
  }
}

/** 优先 OSS manifest（pnpm 上传脚本生成），否则读 public/video 本地文件 */
function getDiscoverVideosFromManifest(): DiscoverVideoItem[] | null {
  const manifest = loadManifest();
  if (!manifest?.videos?.length) return null;

  return manifest.videos.map((item, index) => {
    const cover = HOT_COMIC_COVERS[index % HOT_COMIC_COVERS.length];
    return {
      id: item.id,
      src: item.url,
      playbackSrc: item.url,
      title: cover?.title ?? item.id,
      author: "社区创作者",
      poster: cover?.src,
    };
  });
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

/** OSS manifest → 本地 public/video → 模拟数据 */
export function getLandingShowcase(): LandingShowcase {
  const fromOss = getDiscoverVideosFromManifest();
  if (fromOss) {
    return { covers: HOT_COMIC_COVERS, videos: fromOss };
  }

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
