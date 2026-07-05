"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import * as spark from "@sparkjsdev/spark";

import { buildParticleModifier } from "@/lib/qr-world-splat-fx";

export type QrWorldSparkStage = "preview" | "loading-full" | "ready" | "error";

export type QrWorldSparkHandle = {
  resetView: () => void;
  /** @deprecated 同步 PNG toDataURL 会阻塞 UI；请用 captureScreenshotBlob */
  captureScreenshot: () => string | null;
  captureScreenshotBlob: () => Promise<Blob | null>;
};

type Props = {
  lowResUrl?: string | null;
  highResUrl?: string | null;
  naturalMouse?: boolean;
  invertTrackpadDrag?: boolean;
  className?: string;
  onProgress?: (ratio: number) => void;
  onStageChange?: (stage: QrWorldSparkStage, message?: string) => void;
  onReady?: () => void;
  onFirstVisual?: () => void;
  onError?: (message: string) => void;
};

const SCENE_BG = 0x060910;
const INITIAL_FOV = 75;
const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 2000;
const MIN_FOV = 30;
const MAX_FOV = 120;
const CROSSFADE_MS = 650;
/** 低模预览档；超时后仍尝试高清或降级 */
const LOW_SPLAT_LOAD_TIMEOUT_MS = 90_000;
/** 高清档体积大，经 BFF 流式传输仍可能较慢 */
const HIGH_SPLAT_LOAD_TIMEOUT_MS = 240_000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

type PackedSplats = spark.PackedSplats | spark.ExtSplats;

export const QrWorldSparkCanvas = forwardRef<QrWorldSparkHandle, Props>(function QrWorldSparkCanvas(
  {
    lowResUrl,
    highResUrl,
    naturalMouse = false,
    invertTrackpadDrag = false,
    className = "",
    onProgress,
    onStageChange,
    onReady,
    onFirstVisual,
    onError,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onProgressRef = useRef(onProgress);
  const onStageChangeRef = useRef(onStageChange);
  const onReadyRef = useRef(onReady);
  const onFirstVisualRef = useRef(onFirstVisual);
  const onErrorRef = useRef(onError);
  const resetFnRef = useRef<(() => void) | null>(null);
  const captureSnapshotRef = useRef<(() => string | null) | null>(null);
  const captureSnapshotBlobRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<spark.SparkControls | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      resetView: () => resetFnRef.current?.(),
      captureScreenshot: () => {
        const snap = captureSnapshotRef.current;
        if (snap) return snap();
        const canvas = rendererRef.current?.domElement;
        if (!canvas) return null;
        try {
          return canvas.toDataURL("image/png");
        } catch {
          return null;
        }
      },
      captureScreenshotBlob: () => {
        const snap = captureSnapshotBlobRef.current;
        if (snap) return snap();
        const canvas = rendererRef.current?.domElement;
        if (!canvas) return Promise.resolve(null);
        return new Promise((resolve) => {
          try {
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
          } catch {
            resolve(null);
          }
        });
      },
    }),
    [],
  );

  useEffect(() => {
    onProgressRef.current = onProgress;
    onStageChangeRef.current = onStageChange;
    onReadyRef.current = onReady;
    onFirstVisualRef.current = onFirstVisual;
    onErrorRef.current = onError;
  });

  const low = lowResUrl?.trim() || null;
  const high = highResUrl?.trim() || null;

  useEffect(() => {
    const c = controlsRef.current as
      | (spark.SparkControls & {
          pointerControls?: {
            reverseRotate?: boolean;
            reverseSlide?: boolean;
            reverseSwipe?: boolean;
          };
        })
      | null;
    if (!c?.pointerControls) return;

    // "Natural Mouse": content follows drag direction (reverse camera-style rotate).
    c.pointerControls.reverseRotate = Boolean(naturalMouse);
    // "Invert Trackpad Drag": invert two-finger drag/swipe panning direction.
    c.pointerControls.reverseSlide = Boolean(invertTrackpadDrag);
    c.pointerControls.reverseSwipe = Boolean(invertTrackpadDrag);
  }, [naturalMouse, invertTrackpadDrag]);

  useEffect(() => {
    const host = hostRef.current;
    const primary = high || low;
    if (!host || !primary) return;

    const progressive = Boolean(low && high && low !== high);

    let disposed = false;
    let removeResize: (() => void) | undefined;
    let removeKeys: (() => void) | undefined;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: spark.SparkControls | null = null;

    let lowMesh: spark.SplatMesh | null = null;
    let highMesh: spark.SplatMesh | null = null;
    let singleMesh: spark.SplatMesh | null = null;

    let particleTimeUniform: { value: number } | null = null;
    let crossFading = false;
    let crossFadeStart = 0;
    let transitionDone = false;
    let lastTs = performance.now();

    let singleRevealStart: number | null = null;
    const SINGLE_REVEAL_MS = 1200;

    const setStage = (stage: QrWorldSparkStage, message?: string) => {
      onStageChangeRef.current?.(stage, message);
    };

    const canvas = document.createElement("canvas");
    canvas.className = "h-full w-full touch-none outline-none";
    canvas.tabIndex = 0;
    host.replaceChildren(canvas);
    canvas.addEventListener("pointerdown", () => canvas.focus());

    void (async () => {
      try {
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(SCENE_BG);

        const camera = new THREE.PerspectiveCamera(INITIAL_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
        scene.add(camera);

        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        });
        rendererRef.current = renderer;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const resize = () => {
          const w = Math.max(host.clientWidth, 1);
          const h = Math.max(host.clientHeight, 1);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer?.setSize(w, h, false);
        };
        resize();
        window.addEventListener("resize", resize);
        removeResize = () => window.removeEventListener("resize", resize);

        const sparkRenderer = new spark.SparkRenderer({ renderer });
        scene.add(sparkRenderer);

        let initialPos = new THREE.Vector3(0, 0, 0.01);
        let initialQuat = new THREE.Quaternion();

        const setInitialView = () => {
          camera.position.set(0, 0, 0.01);
          camera.quaternion.set(0, 0, 0, 1);
          initialPos = camera.position.clone();
          initialQuat = camera.quaternion.clone();
        };

        const saveCameraPose = () => {
          resetFnRef.current = () => {
            camera.position.copy(initialPos);
            camera.quaternion.copy(initialQuat);
            camera.fov = INITIAL_FOV;
            camera.updateProjectionMatrix();
          };
        };

        setInitialView();
        saveCameraPose();

        controls = new spark.SparkControls({ canvas });
        controlsRef.current = controls;
        controls.fpsMovement.keycodeMoveMapping.Space = new THREE.Vector3(0, 1, 0);
        const pointer = (controls as spark.SparkControls & {
          pointerControls?: {
            reverseRotate?: boolean;
            reverseSlide?: boolean;
            reverseSwipe?: boolean;
          };
        }).pointerControls;
        if (pointer) {
          pointer.reverseRotate = Boolean(naturalMouse);
          pointer.reverseSlide = Boolean(invertTrackpadDrag);
          pointer.reverseSwipe = Boolean(invertTrackpadDrag);
        }

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.code === "Digit0" || event.code === "Numpad0") {
            resetFnRef.current?.();
          } else if (event.key === "[") {
            camera.fov = Math.min(MAX_FOV, camera.fov + 2);
            camera.updateProjectionMatrix();
          } else if (event.key === "]") {
            camera.fov = Math.max(MIN_FOV, camera.fov - 2);
            camera.updateProjectionMatrix();
          }
        };
        window.addEventListener("keydown", onKeyDown);
        removeKeys = () => window.removeEventListener("keydown", onKeyDown);

        const loader = new spark.SplatLoader();
        loader.fileLoader.withCredentials = true;

        const loadPacked = async (
          url: string,
          reportProgress: boolean,
          onRatio?: (ratio: number) => void,
          timeoutMs = LOW_SPLAT_LOAD_TIMEOUT_MS,
        ): Promise<PackedSplats | null> => {
          try {
            const packed = await withTimeout(
              loader.loadAsync(url, (event) => {
                if (!event.lengthComputable || disposed) return;
                const ratio = Math.max(0, Math.min(1, event.loaded / event.total));
                if (reportProgress) onProgressRef.current?.(ratio);
                onRatio?.(ratio);
              }),
              timeoutMs,
              "splat_load",
            );
            if (disposed) return null;
            await packed.initialized;
            if (disposed) return null;
            return packed;
          } catch (err) {
            if (disposed) return null;
            console.warn("[QrWorldSparkCanvas] splat load failed:", url, err);
            return null;
          }
        };

        const makeMeshFromPacked = async (
          packed: PackedSplats,
          worldModifier?: spark.GsplatModifier,
        ): Promise<spark.SplatMesh | null> => {
          const mesh = new spark.SplatMesh({
            packedSplats: packed as spark.PackedSplats,
            worldModifier,
          });
          await mesh.initialized;
          if (disposed) {
            mesh.dispose();
            return null;
          }
          mesh.quaternion.set(1, 0, 0, 0);
          mesh.updateGenerator();
          return mesh;
        };

        const finishLowOnlyPreview = () => {
          if (!lowMesh) return;
          lowMesh.worldModifier = undefined;
          lowMesh.updateGenerator();
          lowMesh.opacity = 1;
          transitionDone = true;
          crossFading = false;
          setStage("ready");
          onReadyRef.current?.();
        };

        const startRenderLoop = () => {
          if (!renderer) return;
          captureSnapshotRef.current = () => {
            if (disposed || !renderer) return null;
            controls?.update(camera);
            renderer.render(scene, camera);
            try {
              return renderer.domElement.toDataURL("image/jpeg", 0.9);
            } catch {
              return null;
            }
          };
          captureSnapshotBlobRef.current = () =>
            new Promise((resolve) => {
              if (disposed || !renderer) {
                resolve(null);
                return;
              }
              controls?.update(camera);
              renderer.render(scene, camera);
              try {
                renderer.domElement.toBlob(
                  (blob) => resolve(blob),
                  "image/jpeg",
                  0.9,
                );
              } catch {
                resolve(null);
              }
            });
          renderer.setAnimationLoop(() => {
            if (disposed || !renderer) return;
            const now = performance.now();
            const dt = (now - lastTs) / 1000;
            lastTs = now;

            if (progressive) {
              if (particleTimeUniform) {
                particleTimeUniform.value += dt;
              }

              if (crossFading && !transitionDone && lowMesh && highMesh) {
                const t = Math.min(1, (now - crossFadeStart) / CROSSFADE_MS);
                const p = t * t * (3 - 2 * t);
                lowMesh.opacity = 1 - p;
                highMesh.opacity = p;
                lowMesh.needsUpdate = true;
                highMesh.needsUpdate = true;

                if (t >= 1) {
                  transitionDone = true;
                  crossFading = false;
                  highMesh.opacity = 1;
                  highMesh.needsUpdate = true;

                  scene.remove(lowMesh);
                  lowMesh.dispose();
                  lowMesh = null;
                  particleTimeUniform = null;

                  setStage("ready");
                }
              } else if (lowMesh && !transitionDone) {
                lowMesh.needsUpdate = true;
              }
            } else if (singleMesh && singleRevealStart != null) {
              const t = Math.min(1, (now - singleRevealStart) / SINGLE_REVEAL_MS);
              singleMesh.opacity = 1 - Math.pow(1 - t, 3);
              if (t >= 1) {
                singleRevealStart = null;
                setStage("ready");
                onReadyRef.current?.();
              }
            }

            controls?.update(camera);
            renderer.render(scene, camera);
          });
        };

        if (progressive) {
          setStage("preview", "Loading preview...");
          onProgressRef.current?.(0);
          startRenderLoop();

          const highLoadPromise = loadPacked(
            high!,
            false,
            (ratio) => {
              const pct = Math.round(ratio * 100);
              setStage("loading-full", `加载高清画质 · ${pct}%`);
              onProgressRef.current?.(ratio);
            },
            HIGH_SPLAT_LOAD_TIMEOUT_MS,
          );

          let lowPacked: PackedSplats | null = null;
          lowPacked = await loadPacked(low!, true);

          if (disposed) return;

          if (!lowPacked && !disposed) {
            setStage("loading-full", "Loading full quality...");
            const highPacked = await highLoadPromise;
            if (disposed || !highPacked) {
              if (!disposed) {
                onErrorRef.current?.("Splat 资源加载失败，请稍后重试");
                setStage("error", "Splat 资源加载失败");
              }
              return;
            }
            singleMesh = await makeMeshFromPacked(highPacked);
            if (disposed || !singleMesh) return;
            singleMesh.opacity = 1;
            scene.add(singleMesh);
            onFirstVisualRef.current?.();
            setStage("ready");
            onReadyRef.current?.();
            return;
          }

          const particle = buildParticleModifier(spark);
          particleTimeUniform = particle.timeUniform;

          if (!lowPacked) return;
          lowMesh = await makeMeshFromPacked(lowPacked, particle.modifier);
          if (disposed || !lowMesh) return;
          scene.add(lowMesh);
          onFirstVisualRef.current?.();
          setStage("preview", "Particle preview");

          setStage("loading-full", "加载高清画质…");

          const highPacked = await highLoadPromise;
          if (disposed) return;
          if (!highPacked) {
            finishLowOnlyPreview();
            onFirstVisualRef.current?.();
            return;
          }

          highMesh = await makeMeshFromPacked(highPacked);
          if (disposed || !highMesh) return;
          highMesh.opacity = 0;
          highMesh.visible = true;
          scene.add(highMesh);

          setStage("loading-full", "Compositing…");
          crossFading = true;
          crossFadeStart = performance.now();
        } else {
          setStage("loading-full", "Loading...");
          onProgressRef.current?.(0);
          startRenderLoop();
          const packed = await loadPacked(primary, true);
          if (disposed || !packed) {
            if (!disposed) {
              onErrorRef.current?.("Splat 资源加载失败，请稍后重试");
              setStage("error", "Splat 资源加载失败");
            }
            return;
          }
          singleMesh = await makeMeshFromPacked(packed);
          if (disposed || !singleMesh) return;
          singleMesh.opacity = 1;
          scene.add(singleMesh);
          onFirstVisualRef.current?.();
          setStage("ready");
          onReadyRef.current?.();
        }
      } catch (err) {
        if (disposed) return;
        const raw = err instanceof Error ? err.message : "3D 场景加载失败";
        const msg =
          raw === "fetch failed"
            ? "Splat 资源下载失败，请确认已登录且 book-mall 可访问"
            : raw;
        setStage("error", msg);
        onErrorRef.current?.(msg);
      }
    })();

    return () => {
      disposed = true;
      resetFnRef.current = null;
      captureSnapshotRef.current = null;
      captureSnapshotBlobRef.current = null;
      removeResize?.();
      removeKeys?.();
      renderer?.setAnimationLoop(null);
      controlsRef.current = null;
      rendererRef.current = null;
      lowMesh?.dispose();
      highMesh?.dispose();
      singleMesh?.dispose();
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [low, high]);

  return (
    <div ref={hostRef} data-qr-world-spark-host className={`h-full w-full ${className}`.trim()} style={{ background: "#060910" }} />
  );
});
