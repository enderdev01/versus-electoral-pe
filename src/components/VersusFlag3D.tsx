"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function useCanvasTexture(url: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const W = 1024;
      const H = 1024;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      // contener cuadrado, centrado
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.min(W / iw, H / ih) * 0.92;
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
      setTex(t);
    };
    img.onerror = () => setTex(null);
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return tex;
}

function LogoCoin({
  logoUrl,
  color,
  coinColor,
  mirror,
}: {
  logoUrl: string;
  color: string;
  coinColor: string;
  mirror?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useCanvasTexture(logoUrl);
  // textura espejada para la cara trasera (lee correctamente al voltearse)
  const textureBack = useMemo(() => {
    if (!texture) return null;
    const t = texture.clone();
    t.center.set(0.5, 0.5);
    t.repeat.set(-1, 1);
    t.needsUpdate = true;
    return t;
  }, [texture]);

  const { viewport } = useThree();
  // moneda escala con el viewport — target: ~22% del alto del canvas
  const targetRadius = Math.min(viewport.height * 0.18, viewport.width * 0.22);
  const coinScale = targetRadius / 1.5;
  // anclar en zona superior, dejando padding proporcional
  const anchorY = viewport.height / 2 - targetRadius - viewport.height * 0.14;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!groupRef.current) return;
    groupRef.current.scale.setScalar(coinScale);
    groupRef.current.rotation.y = t * 0.9 * (mirror ? -1 : 1);
    groupRef.current.position.y = anchorY + Math.sin(t * 1.4) * 0.05;
    groupRef.current.rotation.z = Math.sin(t * 0.7) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {/* halo brillante detrás */}
      <mesh position={[0, 0, -0.2]}>
        <ringGeometry args={[1.55, 1.95, 80]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* moneda obsidiana — tono oscuro del color partido */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.18, 96, 1, false]} />
        <meshStandardMaterial
          color={coinColor}
          metalness={0.95}
          roughness={0.18}
          emissive={color}
          emissiveIntensity={0.06}
        />
      </mesh>
      {/* anillo exterior metálico color partido */}
      <mesh>
        <torusGeometry args={[1.52, 0.06, 20, 120]} />
        <meshStandardMaterial
          color={color}
          metalness={1}
          roughness={0.12}
          emissive={color}
          emissiveIntensity={0.7}
        />
      </mesh>
      {/* anillo interior decorativo */}
      <mesh position={[0, 0, 0.095]}>
        <ringGeometry args={[1.32, 1.38, 96]} />
        <meshStandardMaterial
          color={color}
          metalness={0.9}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, -0.095]}>
        <ringGeometry args={[1.32, 1.38, 96]} />
        <meshStandardMaterial
          color={color}
          metalness={0.9}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* cara frontal: logo (círculo enmascarado, sin esquinas del PNG) */}
      {texture && (
        <mesh position={[0, 0, 0.1]}>
          <circleGeometry args={[1.28, 96]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.02}
            depthWrite={false}
          />
        </mesh>
      )}
      {/* cara trasera: logo espejado */}
      {textureBack && (
        <mesh position={[0, 0, -0.1]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[1.28, 96]} />
          <meshBasicMaterial
            map={textureBack}
            transparent
            alphaTest={0.02}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

// Deterministic PRNG: particle positions must stay stable across re-renders,
// so the layout cannot depend on Math.random during render.
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Particles({ color }: { color: string }) {
  const ref = useRef<THREE.Points>(null);
  const { viewport } = useThree();
  const { positions, count } = useMemo(() => {
    const n = 220;
    const w = Math.max(8, viewport.width * 1.4);
    const h = Math.max(8, viewport.height * 1.4);
    const arr = new Float32Array(n * 3);
    const random = createRandom(0x9e3779b9);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (random() - 0.5) * w;
      arr[i * 3 + 1] = (random() - 0.5) * h;
      arr[i * 3 + 2] = (random() - 0.5) * 3;
    }
    return { positions: arr, count: n };
  }, [viewport.width, viewport.height]);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.08;
    ref.current.rotation.x += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color={color}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

interface Props {
  logoUrl: string;
  color: string;
  coinColor: string;
  mirror?: boolean;
}

export function VersusFlag3D({ logoUrl, color, coinColor, mirror }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.NoToneMapping;
      }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[2, 3, 4]} intensity={1.6} />
      <directionalLight position={[-3, -2, 2]} intensity={0.5} color={color} />
      <pointLight position={[0, 0, 3]} intensity={0.6} color={color} />
      <Suspense fallback={null}>
        <LogoCoin logoUrl={logoUrl} color={color} coinColor={coinColor} mirror={mirror} />
        <Particles color={color} />
      </Suspense>
    </Canvas>
  );
}
