"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { canvasProjectPath } from "@/lib/canvas/canvas-project-navigation";

/** 画布内跳另一项目时用 replace，避免浏览器后退串到上一张画布 */
export function CanvasProjectLink({
  projectId,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { projectId: string }) {
  const pathname = usePathname() || "/";
  const replace = pathname.startsWith("/canvas/");
  return (
    <Link href={canvasProjectPath(projectId)} replace={replace} {...props} />
  );
}
