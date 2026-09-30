'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';

export interface OrbSignal { energy: 'idle' | 'busy' | 'live'; level: number }

const DOTS = 2200;
const RADIUS = 0.78;
const CAM_Z = 5;
/** Colour ease rate per second, tuned to finish with the 0.9s CSS transition on `.app`. */
const MORPH_RATE = 4.5;

const VERT = /* glsl */ `
uniform float uTime, uLevel, uBusy, uPx, uPulse;
attribute float aSeed;
varying float vFront, vHot, vCenter;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

void main() {
  vec3 n = normalize(position);
  float slow = noise(n * 1.8 + vec3(0.0, uTime * 0.35, uTime * 0.2));
  float fine = noise(n * 4.5 - uTime * 0.7);
  float amp = 0.045 + 0.34 * uLevel + 0.05 * uBusy + 0.16 * uPulse;
  float disp = (slow - 0.5) * 2.0 * amp + (fine - 0.5) * amp * 0.8;
  // while a request runs, a bright band travels pole to pole
  float scan = exp(-pow((n.y - sin(uTime * 1.7) * 0.92) * 4.5, 2.0)) * uBusy;
  vec3 p = n * (${RADIUS.toFixed(2)} + disp + scan * 0.07);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  vFront = 1.0 - clamp((-mv.z - ${(CAM_Z - RADIUS - 0.3).toFixed(2)}) / ${(2 * RADIUS + 0.6).toFixed(2)}, 0.0, 1.0);
  vHot = clamp(scan + uLevel * smoothstep(0.55, 1.0, slow) + uPulse * 0.7, 0.0, 1.0);
  // leave the middle of the front face quiet so the voice name stays readable
  float r = length(gl_Position.xy / gl_Position.w);
  vCenter = mix(1.0, 0.12 + 0.88 * smoothstep(0.10, 0.34, r), smoothstep(0.35, 0.7, vFront));
  gl_PointSize = uPx * (0.8 + 1.1 * aSeed) * (1.0 + scan * 1.4 + uLevel * 0.7 + uPulse * 0.9) * (${CAM_Z.toFixed(1)} / -mv.z);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFront, vHot, vCenter;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d);
  float shade = mix(0.16, 1.0, vFront);
  vec3 col = mix(uColor, vec3(1.0, 0.95, 0.88), vHot * 0.65);
  gl_FragColor = vec4(col * shade, a * shade * vCenter);
  #include <colorspace_fragment>
}`;

/** Evenly spread points on a sphere (Fibonacci lattice). */
function lattice(n: number) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = golden * i;
    pos.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
    seed[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    if (seed[i] < 0) seed[i] += 1;
  }
  return { pos, seed };
}

function Dots({ signal, color, still }: { signal: RefObject<OrbSignal>; color: string; still: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => lattice(DOTS), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uLevel: { value: 0 }, uBusy: { value: 0 }, uPulse: { value: 0 }, uPx: { value: 2 }, uColor: { value: new THREE.Color(color) },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps -- color is applied in the effect below

  // A new colour is a target the frame loop eases toward, and it kicks off a swell that decays on its own.
  const target = useMemo(() => new THREE.Color(color), []); // eslint-disable-line react-hooks/exhaustive-deps -- retargeted in the effect below
  const shown = useRef(color);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (shown.current === color) return;
    shown.current = color;
    target.set(color);
    if (still) { uniforms.uColor.value.copy(target); invalidate(); } else uniforms.uPulse.value = 1;
  }, [color, still, target, uniforms, invalidate]);

  const smooth = useRef({ level: 0, busy: 0 });
  useFrame((state, dt) => {
    const s = signal.current, k = Math.min(1, dt * 9);
    smooth.current.level += ((s.energy === 'live' ? s.level : 0) - smooth.current.level) * k;
    smooth.current.busy += ((s.energy === 'busy' ? 1 : 0) - smooth.current.busy) * Math.min(1, dt * 5);
    const u = mat.current!.uniforms;
    u.uTime.value += dt * (1 + 1.6 * smooth.current.level + 0.8 * smooth.current.busy);
    u.uLevel.value = smooth.current.level;
    u.uBusy.value = smooth.current.busy;
    u.uColor.value.lerp(target, 1 - Math.exp(-dt * MORPH_RATE));
    u.uPulse.value *= Math.exp(-dt * 2.6);
    u.uPx.value = state.gl.getPixelRatio() * 2.1;
    group.current!.rotation.y += dt * (0.12 + 0.5 * smooth.current.level + 0.35 * smooth.current.busy + 1.2 * u.uPulse.value);
    group.current!.rotation.x = 0.28;
  });

  return (
    <group ref={group}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geo.pos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[geo.seed, 1]} />
        </bufferGeometry>
        <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={VERT} fragmentShader={FRAG}
          transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

/** The hero orb's 3D core: a sphere of dots that swells with the audio level and scans while a request runs. */
export default function OrbGL({ signal, color, paused }: { signal: RefObject<OrbSignal>; color: string; paused: boolean }) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return (
    <Canvas className="orb-gl" aria-hidden="true" dpr={[1, 2]} frameloop={paused ? 'never' : still ? 'demand' : 'always'}
      camera={{ position: [0, 0, CAM_Z], fov: 35 }} gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}>
      <Dots signal={signal} color={color} still={still} />
    </Canvas>
  );
}
