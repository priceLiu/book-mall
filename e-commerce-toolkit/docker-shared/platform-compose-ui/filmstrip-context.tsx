"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { VideoFilmstripFrame } from "./types";

export type FetchVideoFilmstripFn = (args: {
  sourceVideoUrl: string;
  projectId: string;
  frameCount: number;
}) => Promise<{ durationSec: number; frames: VideoFilmstripFrame[] }>;

const FilmstripFetchContext = createContext<FetchVideoFilmstripFn | null>(null);

export function ComposeFilmstripProvider({
  fetchFilmstrip,
  children,
}: {
  fetchFilmstrip: FetchVideoFilmstripFn;
  children: ReactNode;
}) {
  return (
    <FilmstripFetchContext.Provider value={fetchFilmstrip}>
      {children}
    </FilmstripFetchContext.Provider>
  );
}

export function useFetchVideoFilmstrip(): FetchVideoFilmstripFn {
  const fn = useContext(FilmstripFetchContext);
  if (!fn) {
    throw new Error("useFetchVideoFilmstrip requires ComposeFilmstripProvider");
  }
  return fn;
}
