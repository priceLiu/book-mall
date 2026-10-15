"use client";

import { useEffect, useState } from "react";

type LoadState = {
  /** 展示用 URL（优先 blob，失败则原 URL） */
  displaySrc: string;
  progress: number;
  indeterminate: boolean;
  ready: boolean;
  failed: boolean;
};

/** 远程图片加载：XHR 可计算进度；失败时回退原 URL + img onLoad */
export function useQrRemoteImageLoad(src: string): LoadState & {
  onImgLoad: () => void;
  onImgError: () => void;
} {
  const [displaySrc, setDisplaySrc] = useState(src);
  const [progress, setProgress] = useState(0);
  const [indeterminate, setIndeterminate] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [xhrDone, setXhrDone] = useState(false);

  useEffect(() => {
    setDisplaySrc(src);
    setProgress(0);
    setIndeterminate(true);
    setReady(false);
    setFailed(false);
    setXhrDone(false);

    let objectUrl: string | null = null;
    const xhr = new XMLHttpRequest();
    xhr.open("GET", src);
    xhr.responseType = "blob";

    xhr.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        setIndeterminate(false);
        setProgress(Math.min(1, event.loaded / event.total));
      } else {
        setIndeterminate(true);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response instanceof Blob) {
        objectUrl = URL.createObjectURL(xhr.response);
        setDisplaySrc(objectUrl);
        setProgress(1);
        setIndeterminate(false);
        setReady(true);
        setXhrDone(true);
        return;
      }
      setFailed(true);
      setXhrDone(true);
      setDisplaySrc(src);
    };

    xhr.onerror = () => {
      setFailed(true);
      setXhrDone(true);
      setDisplaySrc(src);
    };

    xhr.send();

    return () => {
      xhr.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const onImgLoad = () => {
    if (!xhrDone || failed) {
      setProgress(1);
      setIndeterminate(false);
      setReady(true);
    }
  };

  const onImgError = () => {
    setReady(true);
    setIndeterminate(false);
  };

  return {
    displaySrc,
    progress,
    indeterminate: indeterminate && !ready,
    ready,
    failed,
    onImgLoad,
    onImgError,
  };
}
