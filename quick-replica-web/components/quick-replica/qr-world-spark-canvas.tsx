"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import {
  buildParticleModifier,
  frameCameraToSplatMesh,
} from "@/lib/qr-world-splat-fx";

export type QrWorldSparkStage = "preview" | "loading-full" | "ready" | "error";

export type QrWorldSparkHandle = {
  resetView: () => void;
};

type Props = {
  lowResUrl?: string | null;
  highResUrl?: string | null;
  className?: string;
  onProgress?: (ratio: number) => void;
  onStageChange?: (stage: QrWorldSparkStage, message?: string) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
};

const SCENE_BG = 0x060910;
const INITIAL_FOV = 75;
const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 2000;
const MIN_FOV = 30;
const MAX_FOV = 120;
const CROSSFADE_MS = 650;

export const QrWorldSparkCanvas = forwardRef<QrWorldSparkHandle, Props>(function QrWorldSparkCanvas(
  { lowResUrl, highResUrl, className = "", onProgress, onStageChange, onReady, onError },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onProgressRef = useRef(onProgress);
  const onStageChangeRef = useRef(onStageChange);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const resetFnRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({ resetView: () => resetFnRef.current?.() }), []);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onStageChangeRef.current = onStageChange;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });

  const low = lowResUrl?.trim() || null;
  const high = highResUrl?.trim() || null;

  useEffect(() => {
    const host = hostRef.current;
    const primary = high || low;
    if (!host || !primary) return;

    const progressive = Boolean(low && high && low !== high);

    let disposed = false;
    let removeResize: (() => void) | undefined;
    let removeKeys: (() => void) | undefined;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: import("@sparkjsdev/spark").SparkControls | null = null;

    let lowMesh: import("@sparkjsdev/spark").SplatMesh | null = null;
    let highMesh: import("@sparkjsdev/spark").SplatMesh | null = null;
    let singleMesh: import("@sparkjsdev/spark").SplatMesh | null = null;

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
    host.replaceChildren(canvas);

    void (async () => {
      try {
        const THREE = await import("three");
        const spark = await import("@sparkjsdev/spark");

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

        let initialPos = new THREE.Vector3(0, 1, 0);
        let initialQuat = new THREE.Quaternion();

        const saveCameraPose = () => {
          initialPos = camera.position.clone();
          initialQuat = camera.quaternion.clone();
          resetFnRef.current = () => {
            camera.position.copy(initialPos);
            camera.quaternion.copy(initialQuat);
            camera.fov = INITIAL_FOV;
            camera.updateProjectionMatrix();
          };
        };

        controls = new spark.SparkControls({ canvas });
        controls.fpsMovement.keycodeMoveMapping.Space = new THREE.Vector3(0, 1, 0);

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
        ) => {
          const packed = await loader.loadAsync(url, (event) => {
            if (!event.lengthComputable) return;
            const ratio = Math.max(0, Math.min(1, event.loaded / event.total));
            if (reportProgress) onProgressRef.current?.(ratio);
            onRatio?.(ratio);
          });
          if (disposed) throw new Error("disposed");
          await packed.initialized;
          return packed;
        };

        const makeMeshFromPacked = async (
          packed: import("@sparkjsdev/spark").PackedSplats | import("@sparkjsdev/spark").ExtSplats,
          worldModifier?: import("@sparkjsdev/spark").GsplatModifier,
        ) => {
          const mesh = new spark.SplatMesh({
            packedSplats: packed as import("@sparkjsdev/spark").PackedSplats,
            worldModifier,
          });
          await mesh.initialized;
          if (disposed) {
            mesh.dispose();
            throw new Error("disposed");
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

          // 100k 与 full_res 并行下载，缩短「粒子 → 成片」空窗
          const highLoadPromise = loadPacked(high!, false, (ratio) => {
            setStage("loading-full", `${Math.round(ratio * 100)}%`);
          });

          const lowPacked = await loadPacked(low!, true);
          const particle = buildParticleModifier(spark);
          particleTimeUniform = particle.timeUniform;

          lowMesh = await makeMeshFromPacked(lowPacked, particle.modifier);
          scene.add(lowMesh);
          frameCameraToSplatMesh(THREE, camera, lowMesh);
          saveCameraPose();
          startRenderLoop();
          setStage("preview", "Particle preview");

          setStage("loading-full", "Loading full quality...");
          onProgressRef.current?.(0);

          let highPacked: import("@sparkjsdev/spark").PackedSplats | import("@sparkjsdev/spark").ExtSplats;
          try {
            highPacked = await highLoadPromise;
          } catch {
            if (disposed) return;
            finishLowOnlyPreview();
            return;
          }

          if (disposed) return;

          highMesh = await makeMeshFromPacked(highPacked);
          highMesh.opacity = 0;
          highMesh.visible = true;
          scene.add(highMesh);

          frameCameraToSplatMesh(THREE, camera, highMesh);
          saveCameraPose();

          setStage("loading-full", "Compositing…");
          crossFading = true;
          crossFadeStart = performance.now();
        } else {
          setStage("loading-full", "Loading...");
          onProgressRef.current?.(0);
          const packed = await loadPacked(primary, true);
          singleMesh = await makeMeshFromPacked(packed);
          singleMesh.opacity = 0;
          scene.add(singleMesh);
          frameCameraToSplatMesh(THREE, camera, singleMesh);
          saveCameraPose();
          singleRevealStart = performance.now();
          startRenderLoop();
        }
      } catch (err) {
        if (!disposed) {
          const raw = err instanceof Error ? err.message : "3D 场景加载失败";
          const msg =
            raw === "fetch failed"
              ? "Splat 资源下载失败，请确认已登录且 book-mall 可访问"
              : raw;
          setStage("error", msg);
          onErrorRef.current?.(msg);
        }
      }
    })();

    return () => {
      disposed = true;
      resetFnRef.current = null;
      removeResize?.();
      removeKeys?.();
      renderer?.setAnimationLoop(null);
      lowMesh?.dispose();
      highMesh?.dispose();
      singleMesh?.dispose();
      renderer?.dispose();
      host.replaceChildren();
    };
  }, [low, high]);

  return (
    <div ref={hostRef} className={`h-full w-full ${className}`.trim()} style={{ background: "#060910" }} />
  );
});
