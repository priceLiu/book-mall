"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import {
  buildParticleModifier,
  buildRevealModifier,
  composeModifiers,
  easeInOutCubic,
  MAX_RADIUS,
  TRANSITION_MS,
} from "@/lib/qr-world-splat-fx";

export type QrWorldSparkHandle = {
  /** 复位相机到初始视角（不重新下载 splat） */
  resetView: () => void;
};

type Props = {
  /** 低模档（150k/100k）：先渲染出发光粒子 */
  lowResUrl?: string | null;
  /** 高模档（full_res/3m/500k）：揭示后的清晰画质 */
  highResUrl?: string | null;
  className?: string;
  onProgress?: (ratio: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
};

const INITIAL_FOV = 65;
const MIN_FOV = 30;
const MAX_FOV = 100;

export const QrWorldSparkCanvas = forwardRef<QrWorldSparkHandle, Props>(function QrWorldSparkCanvas(
  { lowResUrl, highResUrl, className = "", onProgress, onReady, onError },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const resetFnRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({ resetView: () => resetFnRef.current?.() }), []);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });

  const low = lowResUrl?.trim() || null;
  const high = highResUrl?.trim() || null;

  useEffect(() => {
    const host = hostRef.current;
    const primary = high || low;
    if (!host || !primary) return;

    // 有独立低模 + 高模且不相同时，走 Marble 式两档渐进揭示
    const progressive = Boolean(low && high && low !== high);

    let disposed = false;
    let removeResize: (() => void) | undefined;
    let removeKeys: (() => void) | undefined;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: import("@sparkjsdev/spark").SparkControls | null = null;

    let lowMesh: import("@sparkjsdev/spark").SplatMesh | null = null;
    let highMesh: import("@sparkjsdev/spark").SplatMesh | null = null;
    let singleMesh: import("@sparkjsdev/spark").SplatMesh | null = null;

    // 渐进揭示状态
    let particleTimeUniform: { value: number } | null = null;
    let lowRevealRadius: { value: number } | null = null;
    let highRevealRadius: { value: number } | null = null;
    let lowReady = false;
    let highReady = false;
    let transitioning = false;
    let transitionDone = false;
    let transitionStart = 0;
    let timeAccum = 0;
    let lastTs = performance.now();

    // 单档淡入
    let singleRevealStart: number | null = null;

    const canvas = document.createElement("canvas");
    canvas.className = "h-full w-full touch-none outline-none";
    host.replaceChildren(canvas);

    void (async () => {
      try {
        const THREE = await import("three");
        const spark = await import("@sparkjsdev/spark");

        if (disposed) return;

        const scene = new THREE.Scene();
        // near 提到 0.1（Marble 同级）——0.01 会让贴脸 splat 投影成巨大拉花
        const camera = new THREE.PerspectiveCamera(INITIAL_FOV, 1, 0.1, 1000);
        scene.add(camera);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

        // 与 Marble 官方查看器一致：SparkRenderer 全部使用默认值。
        // （此前 maxStdDev:√9 + lodSplatScale:2 会加重针刺/径向拉花且更卡）
        const sparkRenderer = new spark.SparkRenderer({ renderer });
        scene.add(sparkRenderer);

        // Marble ec() 的取景：站在眼高 (0,1,0) 看向 (0,1,-10)
        camera.position.set(0, 1, 0);
        camera.lookAt(0, 1, -10);
        const initialPos = camera.position.clone();
        const initialQuat = camera.quaternion.clone();

        controls = new spark.SparkControls({ canvas });
        controls.fpsMovement.keycodeMoveMapping.Space = new THREE.Vector3(0, 1, 0);

        const applyReset = () => {
          camera.position.copy(initialPos);
          camera.quaternion.copy(initialQuat);
          camera.fov = INITIAL_FOV;
          camera.updateProjectionMatrix();
        };
        resetFnRef.current = applyReset;

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.code === "Digit0" || event.code === "Numpad0") {
            applyReset();
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

        const makeMesh = (
          url: string,
          opts: { reportProgress: boolean; onLoad: (mesh: import("@sparkjsdev/spark").SplatMesh) => void },
        ) => {
          const mesh = new spark.SplatMesh({
            url,
            enableLod: true,
            lod: "quality",
            onProgress: (event) => {
              if (!opts.reportProgress || !event.total) return;
              onProgressRef.current?.(Math.max(0, Math.min(1, event.loaded / event.total)));
            },
            onLoad: () => {
              if (disposed) return;
              opts.onLoad(mesh);
            },
          });
          mesh.quaternion.set(1, 0, 0, 0);
          return mesh;
        };

        if (progressive) {
          // 粒子修饰器（低模）
          const particle = buildParticleModifier(spark);
          particleTimeUniform = particle.timeUniform;
          const revealLow = buildRevealModifier(spark, THREE, false);
          const revealHigh = buildRevealModifier(spark, THREE, true);
          lowRevealRadius = revealLow.radiusUniform;
          highRevealRadius = revealHigh.radiusUniform;
          const lowComposed = composeModifiers(spark, particle.modifier, revealLow.modifier);

          lowMesh = makeMesh(low!, {
            reportProgress: true,
            onLoad: (mesh) => {
              mesh.worldModifier = particle.modifier;
              mesh.updateGenerator();
              lowReady = true;
              onReadyRef.current?.();
            },
          });
          scene.add(lowMesh);

          highMesh = makeMesh(high!, {
            reportProgress: false,
            onLoad: () => {
              highReady = true;
            },
          });
          highMesh.visible = false;
          scene.add(highMesh);

          // 保存合成修饰器供揭示开始时挂载
          (lowMesh as unknown as { __lowComposed?: unknown }).__lowComposed = lowComposed;
          (highMesh as unknown as { __revealHigh?: unknown }).__revealHigh = revealHigh.modifier;
        } else {
          singleMesh = makeMesh(primary, {
            reportProgress: true,
            onLoad: () => {
              singleRevealStart = performance.now();
              onReadyRef.current?.();
            },
          });
          singleMesh.opacity = 0;
          scene.add(singleMesh);
        }

        const SINGLE_REVEAL_MS = 1200;
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

        renderer.setAnimationLoop(() => {
          if (disposed || !renderer) return;
          const now = performance.now();
          const dt = (now - lastTs) / 1000;
          lastTs = now;

          if (progressive) {
            // 粒子动画时间推进
            timeAccum += dt;
            if (particleTimeUniform) particleTimeUniform.value = timeAccum;
            if (lowReady && !transitioning && !transitionDone && lowMesh) {
              lowMesh.needsUpdate = true;
            }

            // 低模+高模就绪 → 开始扩散球揭示
            if (lowReady && highReady && !transitioning && !transitionDone && lowMesh && highMesh) {
              transitioning = true;
              transitionStart = now;
              const lowComposed = (lowMesh as unknown as { __lowComposed?: unknown }).__lowComposed;
              const revealHigh = (highMesh as unknown as { __revealHigh?: unknown }).__revealHigh;
              if (lowComposed)
                lowMesh.worldModifier = lowComposed as import("@sparkjsdev/spark").SplatMesh["worldModifier"];
              if (revealHigh)
                highMesh.worldModifier = revealHigh as import("@sparkjsdev/spark").SplatMesh["worldModifier"];
              lowMesh.updateGenerator();
              highMesh.updateGenerator();
              highMesh.visible = true;
            }

            if (transitioning && !transitionDone) {
              const t = Math.min(1, (now - transitionStart) / TRANSITION_MS);
              const p = easeInOutCubic(t);
              const radius = Math.pow(p, 1.5) * MAX_RADIUS;
              if (lowRevealRadius) lowRevealRadius.value = radius;
              if (highRevealRadius) highRevealRadius.value = radius;
              if (lowMesh) {
                lowMesh.needsUpdate = true;
                lowMesh.visible = p < 1;
              }
              if (highMesh) highMesh.needsUpdate = true;

              if (t >= 1) {
                transitionDone = true;
                if (highMesh) {
                  highMesh.worldModifier = undefined;
                  highMesh.updateGenerator();
                }
                if (lowMesh) {
                  lowMesh.visible = false;
                  scene.remove(lowMesh);
                  lowMesh.dispose();
                  lowMesh = null;
                }
              }
            }
          } else if (singleMesh && singleRevealStart != null) {
            const t = Math.min(1, (now - singleRevealStart) / SINGLE_REVEAL_MS);
            singleMesh.opacity = easeOut(t);
            if (t >= 1) singleRevealStart = null;
          }

          controls?.update(camera);
          renderer.render(scene, camera);
        });
      } catch (err) {
        if (!disposed) {
          onErrorRef.current?.(err instanceof Error ? err.message : "3D 场景加载失败");
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

  return <div ref={hostRef} className={`h-full w-full bg-black ${className}`.trim()} />;
});
