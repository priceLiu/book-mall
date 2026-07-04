/**
 * QuickReplica 世界加载特效：对齐 openart.ai/suite/world 的 SplatViewer
 * （chunk ffb1a6f2d4f97a80.js）粒子 worldModifier + 扩散球揭示时序。
 *
 * 与 Marble 同源 @sparkjsdev/spark dyno 图；OpenArt 使用 sparsity=0.6、
 * 按场景 bounds 动态 reveal 半径，以及 radius/133×1000ms 揭示时长。
 */

type SparkModule = typeof import("@sparkjsdev/spark");
type ThreeModule = typeof import("three");
type ThreePerspectiveCamera = InstanceType<ThreeModule["PerspectiveCamera"]>;
type ThreeVector3 = InstanceType<ThreeModule["Vector3"]>;
type GsplatModifier = import("@sparkjsdev/spark").GsplatModifier;
type PackedSplats = import("@sparkjsdev/spark").PackedSplats;

/** OpenArt 粒子参数（sparsity=0.6，比 Marble 0.15 更稀疏） */
export const PARTICLE_PARAMS = {
  pointSize: 0.005,
  pointSizeVariation: 0.01,
  pulseSpeed: 2.2,
  pulseAmount: 0.4,
  pulsePhaseVariation: 0.8,
  sparsity: 0.6,
  jitterAmount: 0.01,
  jitterSpeed: 1.1,
  colorShift: 0,
  monochromeAmount: 0,
  glowIntensity: 1.2,
  opacity: 1,
  enabled: 1,
} as const;

/** OpenArt TRANSITION_SPEED：durationMs = radius / TRANSITION_SPEED × 1000 */
export const TRANSITION_SPEED = 133;
export const MIN_TRANSITION_MS = 1500;
export const MAX_TRANSITION_MS = 8000;
export const RING_WIDTH = 2;
export const RING_COLOR: [number, number, number] = [0.627, 0.682, 0.961];

/** easeInOutCubic（OpenArt / Marble 共用） */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export type RevealBounds = {
  center: ThreeVector3;
  radius: number;
};

/**
 * 从 PackedSplats 采样包围盒，计算扩散球心与半径。
 * 球心必须用场景中心（不能写死原点），否则揭示永远对不上几何体。
 */
export function computeRevealBounds(packed: PackedSplats, THREE: ThreeModule): RevealBounds {
  const total = packed.numSplats;
  const center = new THREE.Vector3();
  if (total <= 0) return { center, radius: 1 };

  const samples = Math.min(total, 2000);
  const step = Math.max(1, Math.floor(total / samples));

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < total; i += step) {
    const c = packed.getSplat(i).center;
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    minZ = Math.min(minZ, c.z);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
    maxZ = Math.max(maxZ, c.z);
  }

  center.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);

  let maxDistSq = 0;
  for (let i = 0; i < total; i += step) {
    const c = packed.getSplat(i).center;
    const dx = c.x - center.x;
    const dy = c.y - center.y;
    const dz = c.z - center.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > maxDistSq) maxDistSq = distSq;
  }

  return { center, radius: Math.max(Math.sqrt(maxDistSq) || 1, 0.5) };
}

export function computeTransitionDurationMs(radius: number): number {
  const raw = (radius / TRANSITION_SPEED) * 1000;
  return Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, raw));
}

/** Marble ec() 风格：按 splat 包围盒把相机放到眼高位置 */
export function frameCameraToSplatMesh(
  THREE: ThreeModule,
  camera: ThreePerspectiveCamera,
  mesh: import("@sparkjsdev/spark").SplatMesh,
): void {
  const box = mesh.getBoundingBox(true);
  if (box.isEmpty()) {
    camera.position.set(0, 1, 0);
    camera.lookAt(0, 1, -10);
    camera.updateProjectionMatrix();
    return;
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const eyeLift = Math.min(size.y * 0.12, 1.2) + 0.35;
  camera.position.set(center.x, center.y + eyeLift, center.z + 0.01);
  camera.lookAt(center.x, center.y, center.z - maxDim * 0.38);
  camera.updateProjectionMatrix();
}

const PARTICLE_GLOBALS = `
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec3 hash3v(float n) {
  return fract(sin(vec3(n, n + 1.0, n + 2.0)) * vec3(43758.5453123, 22578.1459123, 19642.3490423));
}

vec3 smoothJitter(vec3 pos, float time, float amount, float speed, float seed) {
  float t = time * speed;
  vec3 offset = vec3(
    sin(pos.y * 2.0 + t + seed * 6.28),
    sin(pos.z * 2.0 + t * 0.8 + seed * 3.14),
    sin(pos.x * 2.0 + t * 1.1 + seed * 1.57)
  );
  offset += vec3(
    sin(pos.z * 3.0 + t * 1.3) * 0.5,
    sin(pos.x * 3.0 + t * 1.5) * 0.5,
    sin(pos.y * 3.0 + t * 1.7) * 0.5
  );
  return offset * amount;
}

float pulseValue(float time, float speed, float phase, float amount) {
  return 1.0 + sin(time * speed + phase) * amount;
}

vec3 makePointScale(float baseSize, float sizeVar, float pulse) {
  float finalSize = baseSize * (1.0 + sizeVar) * pulse;
  return vec3(finalSize);
}

vec3 pointColor(vec3 originalColor, float mono, float shift, float glow) {
  float luma = dot(originalColor, vec3(0.299, 0.587, 0.114));
  vec3 gray = vec3(luma);
  vec3 tinted = gray + vec3(shift * 0.1, shift * 0.05, shift * 0.15);
  vec3 color = mix(originalColor, tinted, mono);
  return color * glow;
}
`;

export function buildParticleModifier(spark: SparkModule): {
  modifier: GsplatModifier;
  timeUniform: { value: number };
} {
  const K = spark.dyno;
  const p = PARTICLE_PARAMS;

  const time = K.dynoFloat(0);
  const pointSize = K.dynoFloat(p.pointSize);
  const pointSizeVariation = K.dynoFloat(p.pointSizeVariation);
  const pulseSpeed = K.dynoFloat(p.pulseSpeed);
  const pulseAmount = K.dynoFloat(p.pulseAmount);
  const pulsePhaseVariation = K.dynoFloat(p.pulsePhaseVariation);
  const sparsity = K.dynoFloat(p.sparsity);
  const jitterAmount = K.dynoFloat(p.jitterAmount);
  const jitterSpeed = K.dynoFloat(p.jitterSpeed);
  const colorShift = K.dynoFloat(p.colorShift);
  const monochromeAmount = K.dynoFloat(p.monochromeAmount);
  const glowIntensity = K.dynoFloat(p.glowIntensity);
  const opacity = K.dynoFloat(p.opacity);
  const enabled = K.dynoFloat(p.enabled);

  const modifier = K.dynoBlock(
    { gsplat: K.Gsplat },
    { gsplat: K.Gsplat },
    ({ gsplat }) => {
      const dyno = new K.Dyno({
        inTypes: {
          gsplat: K.Gsplat,
          time: "float",
          pointSize: "float",
          pointSizeVariation: "float",
          pulseSpeed: "float",
          pulseAmount: "float",
          pulsePhaseVariation: "float",
          sparsity: "float",
          jitterAmount: "float",
          jitterSpeed: "float",
          colorShift: "float",
          monochromeAmount: "float",
          glowIntensity: "float",
          opacity: "float",
          enabled: "float",
        },
        outTypes: { gsplat: K.Gsplat },
        globals: () => [K.unindent(PARTICLE_GLOBALS)],
        statements: ({ inputs, outputs }) =>
          K.unindentLines(`
            ${outputs.gsplat} = ${inputs.gsplat};

            float indexF = float(${inputs.gsplat}.index);
            float h1 = hash(indexF);
            float h2 = hash(indexF * 2.0);
            float h3 = hash(indexF * 3.0);
            vec3 hv = hash3v(indexF);

            float sparse = h1 > ${inputs.sparsity} ? 1.0 : 0.0;
            float fx = ${inputs.enabled} * sparse;

            vec3 jit = smoothJitter(
              ${inputs.gsplat}.center,
              ${inputs.time},
              ${inputs.jitterAmount},
              ${inputs.jitterSpeed},
              h1
            );

            ${outputs.gsplat}.center = mix(
              ${inputs.gsplat}.center,
              ${inputs.gsplat}.center + jit,
              fx
            );

            float phase = h2 * 6.28318 * ${inputs.pulsePhaseVariation};
            float pulse = pulseValue(
              ${inputs.time},
              ${inputs.pulseSpeed},
              phase,
              ${inputs.pulseAmount}
            );

            vec3 ps = makePointScale(
              ${inputs.pointSize},
              h3 * ${inputs.pointSizeVariation},
              pulse
            );

            ${outputs.gsplat}.scales = mix(
              ${inputs.gsplat}.scales,
              ps,
              fx
            );

            vec3 nc = pointColor(
              ${inputs.gsplat}.rgba.rgb,
              ${inputs.monochromeAmount},
              ${inputs.colorShift} * hv.x,
              ${inputs.glowIntensity}
            );

            ${outputs.gsplat}.rgba.rgb = mix(
              ${inputs.gsplat}.rgba.rgb,
              nc,
              fx
            );

            float tgt = ${inputs.gsplat}.rgba.a * ${inputs.opacity} * sparse;
            ${outputs.gsplat}.rgba.a = mix(
              ${inputs.gsplat}.rgba.a,
              tgt,
              ${inputs.enabled}
            );
          `),
      });
      return {
        gsplat: dyno.apply({
          gsplat,
          time,
          pointSize,
          pointSizeVariation,
          pulseSpeed,
          pulseAmount,
          pulsePhaseVariation,
          sparsity,
          jitterAmount,
          jitterSpeed,
          colorShift,
          monochromeAmount,
          glowIntensity,
          opacity,
          enabled,
        }).gsplat,
      };
    },
  );

  return { modifier: modifier as unknown as GsplatModifier, timeUniform: time };
}

export function buildRevealModifier(
  spark: SparkModule,
  THREE: ThreeModule,
  isHighRes: boolean,
  center: ThreeVector3,
): { modifier: GsplatModifier; radiusUniform: { value: number } } {
  const K = spark.dyno;

  const transitionCenter = K.dynoVec3(center);
  const transitionRadius = K.dynoFloat(0);
  const ringColor = K.dynoVec3(
    new THREE.Vector3(RING_COLOR[0], RING_COLOR[1], RING_COLOR[2]),
  );
  const ringWidth = K.dynoFloat(RING_WIDTH);
  const highRes = K.dynoBool(isHighRes);

  const modifier = K.dynoBlock(
    { gsplat: K.Gsplat },
    { gsplat: K.Gsplat },
    ({ gsplat }) => {
      const dyno = new K.Dyno({
        inTypes: {
          gsplat: K.Gsplat,
          transitionCenter: "vec3",
          transitionRadius: "float",
          ringColor: "vec3",
          ringWidth: "float",
          isHighRes: "bool",
        },
        outTypes: { gsplat: K.Gsplat },
        statements: ({ inputs, outputs }) =>
          K.unindentLines(`
            ${outputs.gsplat} = ${inputs.gsplat};

            float distance = length(${outputs.gsplat}.center - ${inputs.transitionCenter});

            float revealOpacity;
            if (${inputs.isHighRes}) {
              revealOpacity = distance <= ${inputs.transitionRadius} ? 1.0 : 0.0;
            } else {
              revealOpacity = distance > ${inputs.transitionRadius} ? 1.0 : 0.0;
            }

            float ringDistance = abs(distance - ${inputs.transitionRadius});
            float safeRingWidth = max(${inputs.ringWidth}, 0.001);
            float ringFactor = 1.0 - smoothstep(0.0, safeRingWidth, ringDistance);

            vec3 finalColor = mix(${outputs.gsplat}.rgba.rgb, ${inputs.ringColor}, ringFactor * 0.8);

            ${outputs.gsplat}.rgba.rgb = finalColor;
            ${outputs.gsplat}.rgba.a *= revealOpacity;
          `),
      });
      return {
        gsplat: dyno.apply({
          gsplat,
          transitionCenter,
          transitionRadius,
          ringColor,
          ringWidth,
          isHighRes: highRes,
        }).gsplat,
      };
    },
  );

  return { modifier: modifier as unknown as GsplatModifier, radiusUniform: transitionRadius };
}

/** 低模链：先粒子再揭示（OpenArt 在 full_res 就绪后挂载） */
export function composeModifiers(
  spark: SparkModule,
  first: GsplatModifier,
  second: GsplatModifier,
): GsplatModifier {
  const K = spark.dyno;
  type Applier = { apply: (i: { gsplat: unknown }) => { gsplat: unknown } };
  const modifier = K.dynoBlock(
    { gsplat: K.Gsplat },
    { gsplat: K.Gsplat },
    ({ gsplat }) => {
      const afterFirst = (first as unknown as Applier).apply({ gsplat });
      const afterSecond = (second as unknown as Applier).apply({ gsplat: afterFirst.gsplat });
      return { gsplat: afterSecond.gsplat as typeof gsplat };
    },
  );
  return modifier as unknown as GsplatModifier;
}
