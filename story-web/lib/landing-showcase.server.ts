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

function loadManifest(): LandingVideosManifest | null {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
    return JSON.parse(raw) as LandingVideosManifest;
  } catch {
    return null;
  }
}

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

/** OSS manifest → mock；不再扫描 public/video 本地 mp4 */
export function getLandingShowcase(): LandingShowcase {
  const fromOss = getDiscoverVideosFromManifest();
  if (fromOss) {
    return { covers: HOT_COMIC_COVERS, videos: fromOss };
  }
  return getDefaultLandingShowcase();
}

export { getMockDiscoverVideos };
