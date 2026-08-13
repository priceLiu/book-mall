import type Archiver from "archiver";

/** archiver@8 仅导出 ZipArchive 类；@types/archiver@7 尚未同步，运行时 require 加载 */
export function createZipArchive(options?: { zlib?: { level?: number } }): Archiver.Archiver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("archiver") as {
    ZipArchive: new (opts?: object) => Archiver.Archiver;
  };
  return new mod.ZipArchive({
    zlib: { level: 6 },
    ...options,
  });
}

export function formatExportTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}
