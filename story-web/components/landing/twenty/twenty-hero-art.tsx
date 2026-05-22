/** Twenty /why-twenty 风像素触点视觉（纯 SVG/CSS，非 Twenty 资产） */
export function TwentyHeroArt() {
  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-2xl overflow-hidden rounded-sm">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(76,125,255,0.35) 0%, transparent 55%), radial-gradient(circle at 20% 80%, rgba(120,80,255,0.15) 0%, transparent 40%)",
        }}
      />
      <svg
        viewBox="0 0 640 400"
        className="relative h-full w-full"
        aria-hidden
        role="img"
      >
        <defs>
          <filter id="pixelGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* 左手指向中心 */}
        {leftHandPixels.map(([x, y, o]) => (
          <rect key={`l-${x}-${y}`} x={x} y={y} width="8" height="8" fill={`rgba(110,168,254,${o})`} />
        ))}
        {/* 右手指向中心 */}
        {rightHandPixels.map(([x, y, o]) => (
          <rect key={`r-${x}-${y}`} x={x} y={y} width="8" height="8" fill={`rgba(110,168,254,${o})`} />
        ))}
        {/* 中心 spark */}
        <rect x="312" y="188" width="16" height="16" fill="#6ea8fe" filter="url(#pixelGlow)" />
        <rect x="320" y="180" width="8" height="8" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
}

const leftHandPixels: [number, number, number][] = [
  [120, 220, 0.25], [128, 212, 0.35], [136, 204, 0.45], [144, 196, 0.55],
  [152, 188, 0.65], [160, 180, 0.75], [168, 172, 0.85], [176, 164, 0.9],
  [184, 156, 0.95], [192, 148, 0.85], [200, 140, 0.75], [208, 132, 0.65],
  [216, 124, 0.55], [224, 116, 0.45], [232, 108, 0.35], [240, 100, 0.25],
  [160, 196, 0.5], [168, 188, 0.6], [176, 180, 0.7], [184, 172, 0.8],
  [192, 164, 0.85], [200, 156, 0.75], [208, 148, 0.65], [216, 140, 0.55],
  [248, 188, 0.4], [256, 180, 0.5], [264, 172, 0.6], [272, 164, 0.7],
  [280, 176, 0.55], [288, 184, 0.45],
];

const rightHandPixels: [number, number, number][] = [
  [520, 220, 0.25], [512, 212, 0.35], [504, 204, 0.45], [496, 196, 0.55],
  [488, 188, 0.65], [480, 180, 0.75], [472, 172, 0.85], [464, 164, 0.9],
  [456, 156, 0.95], [448, 148, 0.85], [440, 140, 0.75], [432, 132, 0.65],
  [424, 124, 0.55], [416, 116, 0.45], [408, 108, 0.35], [400, 100, 0.25],
  [480, 196, 0.5], [472, 188, 0.6], [464, 180, 0.7], [456, 172, 0.8],
  [448, 164, 0.85], [440, 156, 0.75], [432, 148, 0.65], [424, 140, 0.55],
  [392, 188, 0.4], [384, 180, 0.5], [376, 172, 0.6], [368, 164, 0.7],
  [360, 176, 0.55], [352, 184, 0.45],
];
