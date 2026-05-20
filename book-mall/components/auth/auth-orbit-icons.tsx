import type { OrbitIconConfig } from "@/components/auth/animated-auth-ui";
import {
  IconCss3,
  IconFigma,
  IconGit,
  IconHtml5,
  IconJavaScript,
  IconNextJs,
  IconReact,
  IconTailwind,
  IconTypeScript,
} from "@/components/auth/auth-tech-icons";

/** 图标沿第 2–5 条涟漪轨道分布（半径由 AuthOrbitStage 注入） */
export const LOGIN_ORBIT_ICONS: OrbitIconConfig[] = [
  { duration: 20, delay: 0, reverse: false, component: () => <IconReact /> },
  { duration: 20, delay: 10, reverse: true, component: () => <IconTypeScript /> },
  { duration: 18, delay: 2, reverse: false, component: () => <IconNextJs /> },
  { duration: 24, delay: 5, reverse: true, component: () => <IconTailwind /> },
  { duration: 14, delay: 12, reverse: false, component: () => <IconJavaScript /> },
  { duration: 28, delay: 3, reverse: false, component: () => <IconHtml5 /> },
  { duration: 22, delay: 8, reverse: true, component: () => <IconCss3 /> },
  { duration: 16, delay: 14, reverse: false, component: () => <IconFigma /> },
  { duration: 32, delay: 6, reverse: true, component: () => <IconGit /> },
];

/** 将图标分配到涟漪轨道半径（跳过最内圈，避免压住标题） */
export function assignOrbitRadii(
  icons: OrbitIconConfig[],
  ringRadiiPx: number[]
): OrbitIconConfig[] {
  const usable = ringRadiiPx.slice(1);
  if (usable.length === 0) return icons;

  const slots = [
    usable[0],
    usable[0],
    usable[1],
    usable[2],
    usable[1],
    usable[3],
    usable[2],
    usable[1],
    usable[usable.length - 1],
  ];

  return icons.map((icon, i) => ({
    ...icon,
    path: false,
    radius: slots[i] ?? usable[Math.floor(i % usable.length)],
  }));
}
