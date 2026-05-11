/** 分 -> 展示用金额字符串（元，两位小数） */
export function formatMinorAsYuan(minor: number): string {
  return (minor / 100).toFixed(2);
}
