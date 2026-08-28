"use client";

import { useEffect, useState, useId, memo } from "react";
import { GRAVEDAD, type GravedadKey } from "@/lib/candidatos";

interface VelocimetroProps {
  gravedad: GravedadKey;
  totalNoticias: number;
  animate?: boolean;
}

interface VelocimetroVersusProps {
  leftGravedad: GravedadKey;
  rightGravedad: GravedadKey;
  leftNombre: string;
  rightNombre: string;
  leftNoticias: number;
  rightNoticias: number;
  animate?: boolean;
  onFinish?: () => void;
}

// Numeric score for comparison
const GRAVEDAD_SCORE: Record<GravedadKey, number> = {
  LIMPIO: 0,
  LEVE: 1,
  MODERADO: 2,
  PELIGROSO: 3,
  MUY_PELIGROSO: 4,
};

// Solo gauge: map gravedad to semicircle -180° (left/clean) to 0° (right/dangerous)
const GRAVEDAD_ANGLE: Record<GravedadKey, number> = {
  LIMPIO: -162,
  LEVE: -126,
  MODERADO: -90,
  PELIGROSO: -54,
  MUY_PELIGROSO: -18,
};

const GRAVEDAD_ORDER: GravedadKey[] = [
  "LIMPIO", "LEVE", "MODERADO", "PELIGROSO", "MUY_PELIGROSO"
];

function useAnimatedAngle(targetAngle: number, animate: boolean, startAngle: number, onFinish?: () => void) {
  const [currentAngle, setCurrentAngle] = useState(startAngle);

  useEffect(() => {
    if (!animate) {
      setCurrentAngle(targetAngle);
      onFinish?.();
      return;
    }

    setCurrentAngle(startAngle);
    const steps = 80;
    const duration = 2500;
    const stepTime = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrentAngle(startAngle + (targetAngle - startAngle) * eased);

      if (step >= steps) {
        clearInterval(interval);
        onFinish?.();
      }
    }, stepTime);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAngle, animate, startAngle]);

  return currentAngle;
}

const SpeedtestArc = memo(function SpeedtestArc({ id, mirror }: { id: string; mirror?: boolean }) {
  const cx = 150, cy = 150, r = 120;
  const tickR = 105;
  const totalTicks = 40;

  return (
    <>
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="0">
          {mirror ? (
            <>
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="25%" stopColor="#ea580c" />
              <stop offset="50%" stopColor="#ca8a04" />
              <stop offset="75%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#16a34a" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#16a34a" />
              <stop offset="25%" stopColor="#2563eb" />
              <stop offset="50%" stopColor="#ca8a04" />
              <stop offset="75%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#dc2626" />
            </>
          )}
        </linearGradient>
        <filter id={`${id}-glow`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-needle-glow`}>
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="#1f2937"
        strokeWidth="16"
        fill="none"
      />

      {/* Gradient arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={`url(#${id}-grad)`}
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
        filter={`url(#${id}-glow)`}
      />

      {/* Tick marks */}
      {Array.from({ length: totalTicks + 1 }).map((_, i) => {
        const angle = -180 + (i * 180) / totalTicks;
        const rad = (angle * Math.PI) / 180;
        const isMajor = i % 10 === 0;
        const isMinor = i % 5 === 0;
        const len = isMajor ? 14 : isMinor ? 9 : 5;
        const outerR = tickR;
        const innerR = tickR - len;
        const x1 = cx + outerR * Math.cos(rad);
        const y1 = cy + outerR * Math.sin(rad);
        const x2 = cx + innerR * Math.cos(rad);
        const y2 = cy + innerR * Math.sin(rad);

        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isMajor ? "#9ca3af" : isMinor ? "#4b5563" : "#374151"}
            strokeWidth={isMajor ? 2 : 1}
          />
        );
      })}
    </>
  );
});

function Needle({ angle, color, filterId }: { angle: number; color: string; filterId: string }) {
  const cx = 150, cy = 150, len = 88;
  const rad = (angle * Math.PI) / 180;
  const tipX = cx + len * Math.cos(rad);
  const tipY = cy + len * Math.sin(rad);

  const perpRad = rad + Math.PI / 2;
  const baseW = 4;
  const bx1 = cx + baseW * Math.cos(perpRad);
  const by1 = cy + baseW * Math.sin(perpRad);
  const bx2 = cx - baseW * Math.cos(perpRad);
  const by2 = cy - baseW * Math.sin(perpRad);

  return (
    <g filter={`url(#${filterId})`}>
      <polygon
        points={`${tipX},${tipY} ${bx1},${by1} ${bx2},${by2}`}
        fill={color}
      />
    </g>
  );
}

export function Velocimetro({ gravedad, totalNoticias, animate = true }: VelocimetroProps) {
  const targetAngle = GRAVEDAD_ANGLE[gravedad];
  const currentAngle = useAnimatedAngle(targetAngle, animate, -180);
  const info = GRAVEDAD[gravedad];

  function getColor(a: number) {
    if (a <= -144) return GRAVEDAD.LIMPIO.color;
    if (a <= -108) return GRAVEDAD.LEVE.color;
    if (a <= -72) return GRAVEDAD.MODERADO.color;
    if (a <= -36) return GRAVEDAD.PELIGROSO.color;
    return GRAVEDAD.MUY_PELIGROSO.color;
  }

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 185" className="w-full max-w-[300px]">
        <SpeedtestArc id="solo" />

        {/* Labels */}
        {GRAVEDAD_ORDER.map((g, i) => {
          const angle = -180 + (i * 180) / 5 + 18;
          const rad = (angle * Math.PI) / 180;
          const x = 150 + 80 * Math.cos(rad);
          const y = 150 + 80 * Math.sin(rad);
          return (
            <text key={g} x={x} y={y} fontSize="7" fill={GRAVEDAD[g].color}
              fontWeight="700" textAnchor="middle" dominantBaseline="middle" opacity={0.7}>
              {GRAVEDAD[g].label.toUpperCase()}
            </text>
          );
        })}

        <Needle angle={currentAngle} color={getColor(currentAngle)} filterId="solo-needle-glow" />
        <circle cx="150" cy="150" r="10" fill="#111827" stroke="#374151" strokeWidth="2" />
        <circle cx="150" cy="150" r="4" fill={getColor(currentAngle)} />
      </svg>

      <div className="-mt-2 text-center">
        <span className="text-2xl font-black tracking-wide uppercase" style={{ color: info.color }}>
          {info.label}
        </span>
        <p className="text-xs text-gray-400 mt-0.5">
          {totalNoticias} noticia{totalNoticias !== 1 ? "s" : ""} encontrada{totalNoticias !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * Versus gauge: single needle that tilts toward the more dangerous candidate.
 * Left = Candidato 1 is more dangerous, Right = Candidato 2 is more dangerous.
 * Center (-90°) = empate.
 * Arc: left side red→green, right side green→red (mirror), but we use a single
 * arc where left=danger for C1, right=danger for C2, green in center.
 */
export function VelocimetroVersus({
  leftGravedad, rightGravedad,
  leftNoticias, rightNoticias, animate = true, onFinish,
}: VelocimetroVersusProps) {
  const leftScore = GRAVEDAD_SCORE[leftGravedad];
  const rightScore = GRAVEDAD_SCORE[rightGravedad];

  // Calculate target angle:
  // -90° = center (tie)
  // Toward -180° = left is more dangerous
  // Toward 0° = right is more dangerous
  let targetAngle = -90; // tie
  const diff = rightScore - leftScore;
  if (diff !== 0) {
    // Each gravity level step = ~18° of tilt
    targetAngle = -90 + diff * 18;
  } else if (rightNoticias !== leftNoticias) {
    // Same gravedad, use noticias count as tiebreaker (subtle tilt)
    const noticiasDiff = rightNoticias - leftNoticias;
    targetAngle = -90 + Math.sign(noticiasDiff) * Math.min(Math.abs(noticiasDiff) * 2, 15);
  }

  // Clamp to semicircle
  targetAngle = Math.max(-170, Math.min(-10, targetAngle));

  const currentAngle = useAnimatedAngle(targetAngle, animate, -90, onFinish);

  // Color: red when tilted, green when centered
  const tilt = Math.abs(currentAngle - (-90));
  const maxTilt = 80;
  const intensity = Math.min(tilt / maxTilt, 1);
  // Interpolate from green (#16a34a) → yellow → red (#dc2626)
  function lerpColor(t: number) {
    if (t < 0.5) {
      const p = t * 2;
      const r = Math.round(22 + (202 - 22) * p);
      const g = Math.round(163 + (138 - 163) * p);
      const b = Math.round(74 + (4 - 74) * p);
      return `rgb(${r},${g},${b})`;
    }
    const p = (t - 0.5) * 2;
    const r = Math.round(202 + (220 - 202) * p);
    const g = Math.round(138 + (38 - 138) * p);
    const b = Math.round(4 + (38 - 4) * p);
    return `rgb(${r},${g},${b})`;
  }

  const needleColor = lerpColor(intensity);

  // Determine who's losing
  const isLeftWorse = currentAngle < -90;
  const isRightWorse = currentAngle > -90;

  const uid = useId();
  const gradId = `vs-grad-${uid}`;
  const glowId = `vs-glow-${uid}`;
  const needleGlowId = `vs-needle-glow-${uid}`;

  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 300 185" className="w-full max-w-[420px]">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="15%" stopColor="#ea580c" />
            <stop offset="35%" stopColor="#ca8a04" />
            <stop offset="50%" stopColor="#16a34a" />
            <stop offset="65%" stopColor="#ca8a04" />
            <stop offset="85%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={needleGlowId}>
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d="M 30 150 A 120 120 0 0 1 270 150"
          stroke="#1f2937"
          strokeWidth="16"
          fill="none"
        />

        {/* Gradient arc */}
        <path
          d="M 30 150 A 120 120 0 0 1 270 150"
          stroke={`url(#${gradId})`}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        />

        {/* Tick marks */}
        {Array.from({ length: 41 }).map((_, i) => {
          const angle = -180 + (i * 180) / 40;
          const rad = (angle * Math.PI) / 180;
          const isMajor = i % 10 === 0;
          const isMinor = i % 5 === 0;
          const len = isMajor ? 14 : isMinor ? 9 : 5;
          const outerR = 105;
          const innerR = 105 - len;
          return (
            <line
              key={i}
              x1={150 + outerR * Math.cos(rad)} y1={150 + outerR * Math.sin(rad)}
              x2={150 + innerR * Math.cos(rad)} y2={150 + innerR * Math.sin(rad)}
              stroke={isMajor ? "#9ca3af" : isMinor ? "#4b5563" : "#374151"}
              strokeWidth={isMajor ? 2 : 1}
            />
          );
        })}

        {/* Left label */}
        <text x="30" y="170" fontSize="8" fill="#ef4444" fontWeight="700" textAnchor="start" opacity={isLeftWorse ? 1 : 0.4}>
          MÁS PELIGROSO
        </text>
        {/* Right label */}
        <text x="270" y="170" fontSize="8" fill="#ef4444" fontWeight="700" textAnchor="end" opacity={isRightWorse ? 1 : 0.4}>
          MÁS PELIGROSO
        </text>
        {/* Center label */}
        <text x="150" y="125" fontSize="9" fill="#16a34a" fontWeight="700" textAnchor="middle" opacity={0.5}>
          EMPATE
        </text>

        {/* Needle */}
        <Needle angle={currentAngle} color={needleColor} filterId={needleGlowId} />

        {/* Center hub */}
        <circle cx="150" cy="150" r="12" fill="#111827" stroke="#374151" strokeWidth="2" />
        <circle cx="150" cy="150" r="5" fill={needleColor} />
      </svg>
    </div>
  );
}
