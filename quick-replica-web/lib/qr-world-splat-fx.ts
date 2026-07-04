/**
 * QuickReplica 世界加载特效：忠实移植自 marble.worldlabs.ai 的
 * `_id-*.js`（世界查看器 chunk）中的 `Hs`（粒子 worldModifier）、
 * `Us`（扩散球揭示 worldModifier）与 `Qs`（低→高两档渐进时序）。
 *
 * 由于 QuickReplica 与 Marble 使用同一套 @sparkjsdev/spark，故此处直接
 * 复刻其 GLSL dyno 图，实现「低模发光粒子 → 高模扩散球揭示」的一致观感。
 */

type SparkModule = typeof import("@sparkjsdev/spark");
type ThreeModule = typeof import("three");
type GsplatModifier = import("@sparkjsdev/spark").GsplatModifier;

/** Marble 默认粒子参数（Ws） */
export const PARTICLE_PARAMS = {
  pointSize: 0.005,
  pointSizeVariation: 0.01,
  pulseSpeed: 2.2,
  pulseAmount: 0.4,
  pulsePhaseVariation: 0.8,
  sparsity: 0.15,
  jitterAmount: 0.01,
  jitterSpeed: 1.1,
  colorShift: 0,
  monochromeAmount: 0,
  glowIntensity: 1.2,
  opacity: 1,
  enabled: 1,
} as const;

/** 揭示时序常量（Marble: Ks/Js/Ys/Xs/qs/Zs） */
export const TRANSITION_MS = 3000; // Ks
export const MAX_RADIUS = 2000; // Js（半径 = progress^1.5 × MAX_RADIUS）
export const RING_WIDTH = 2; // Xs
export const RING_COLOR: [number, number, number] = [0.627, 0.682, 0.961]; // Ys 淡紫光环
export const TRANSITION_CENTER: [number, number, number] = [0, 0, 0]; // qs

/** easeInOutCubic（Marble: Zs） */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const PARTICLE_GLOBALS = `
// Hash functions for pseudo-random values
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec3 hash3v(float n) {
  return fract(sin(vec3(n, n + 1.0, n + 2.0)) * vec3(43758.5453123, 22578.1459123, 19642.3490423));
}

// Smooth spatial jitter for organic movement
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

// Pulsing function with phase variation
float pulseValue(float time, float speed, float phase, float amount) {
  return 1.0 + sin(time * speed + phase) * amount;
}

// Convert splats to clean points
vec3 makePointScale(float baseSize, float sizeVar, float pulse) {
  float finalSize = baseSize * (1.0 + sizeVar) * pulse;
  return vec3(finalSize);
}

// Clean monochrome with subtle color
vec3 pointColor(vec3 originalColor, float mono, float shift, float glow) {
  float luma = dot(originalColor, vec3(0.299, 0.587, 0.114));
  vec3 gray = vec3(luma);
  vec3 tinted = gray + vec3(shift * 0.1, shift * 0.05, shift * 0.15);
  vec3 color = mix(originalColor, tinted, mono);
  return color * glow;
}

// Sparsity mask - randomly hide points
float sparsityMask(float hash, float sparsity) {
  return hash > sparsity ? 1.0 : 0.0;
}
`;

/**
 * 粒子 worldModifier（Hs）。返回可复用的 modifier 与随帧更新的 timeUniform。
 */
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
            float hash1 = hash(indexF);
            float hash2 = hash(indexF * 2.0);
            float hash3 = hash(indexF * 3.0);
            vec3 hash3vec = hash3v(indexF);

            float sparse = sparsityMask(hash1, ${inputs.sparsity});
            float effectStrength = ${inputs.enabled} * sparse;

            vec3 jitter = smoothJitter(
              ${inputs.gsplat}.center,
              ${inputs.time},
              ${inputs.jitterAmount},
              ${inputs.jitterSpeed},
              hash1
            );

            ${outputs.gsplat}.center = mix(
              ${inputs.gsplat}.center,
              ${inputs.gsplat}.center + jitter,
              effectStrength
            );

            float phase = hash2 * 6.28318 * ${inputs.pulsePhaseVariation};
            float pulse = pulseValue(
              ${inputs.time},
              ${inputs.pulseSpeed},
              phase,
              ${inputs.pulseAmount}
            );

            vec3 pointScale = makePointScale(
              ${inputs.pointSize},
              hash3 * ${inputs.pointSizeVariation},
              pulse
            );

            ${outputs.gsplat}.scales = mix(
              ${inputs.gsplat}.scales,
              pointScale,
              effectStrength
            );

            vec3 newColor = pointColor(
              ${inputs.gsplat}.rgba.rgb,
              ${inputs.monochromeAmount},
              ${inputs.colorShift} * hash3vec.x,
              ${inputs.glowIntensity}
            );

            ${outputs.gsplat}.rgba.rgb = mix(
              ${inputs.gsplat}.rgba.rgb,
              newColor,
              effectStrength
            );

            float targetOpacity = ${inputs.gsplat}.rgba.a * ${inputs.opacity};
            targetOpacity *= sparse;

            ${outputs.gsplat}.rgba.a = mix(
              ${inputs.gsplat}.rgba.a,
              targetOpacity,
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

/**
 * 扩散球揭示 worldModifier（Us）。返回可复用 modifier 与随帧更新的
 * radiusUniform。isHighRes=true：球内可见；false：球外可见。
 */
export function buildRevealModifier(
  spark: SparkModule,
  THREE: ThreeModule,
  isHighRes: boolean,
): { modifier: GsplatModifier; radiusUniform: { value: number } } {
  const K = spark.dyno;

  const transitionCenter = K.dynoVec3(
    new THREE.Vector3(TRANSITION_CENTER[0], TRANSITION_CENTER[1], TRANSITION_CENTER[2]),
  );
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

/**
 * 组合两个 modifier：先 first 再 second（Marble Qs 中的低模链：粒子 → 揭示）。
 */
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
