import type { FilmPullCharacterRef } from "@/lib/film-pull-types";

export const FILM_PULL_REF_MAX_PER_ROLE = 6;

export type FilmPullRefRole = "model" | "product";

export function isFilmPullModelRefId(id: string): boolean {
  return id.startsWith("ref-film-pull-model-");
}

export function isFilmPullProductRefId(id: string): boolean {
  return id.startsWith("ref-film-pull-product-");
}

export function listFilmPullModelRefs(refs: FilmPullCharacterRef[]): FilmPullCharacterRef[] {
  return refs.filter((r) => isFilmPullModelRefId(r.id) && r.ossUrl?.trim());
}

export function listFilmPullProductRefs(refs: FilmPullCharacterRef[]): FilmPullCharacterRef[] {
  return refs.filter((r) => isFilmPullProductRefId(r.id) && r.ossUrl?.trim());
}

export function readFilmPullProductBrief(project: {
  meta?: { productBrief?: string } | null;
}): string {
  return typeof project.meta?.productBrief === "string" ? project.meta.productBrief.trim() : "";
}
