'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { memo, useEffect, useState } from 'react';
import type { Mode } from '../api/client';
import { level } from '../lib/audio';
import { useBlendedPalette } from '../lib/color';

/** Dark, saturated triads per mode. The first colour carries the mode accent, the rest keep the field moody. */
export const AURORA: Record<Mode, readonly [string, string, string]> = {
  tts: ['#ff6a2b', '#5a1a08', '#ff9a5c'],
  stt: ['#a6e35a', '#0f4a26', '#3fd08a'],
  sts: ['#b9a2ff', '#3b1c9a', '#8a5cff'],
};

/** Audio level quantised to tenths, so a re-render happens only when the sound visibly changes. */
function useAudioEnergy(enabled: boolean) {
  const [q, setQ] = useState(0);
  useEffect(() => {
    if (!enabled) { setQ(0); return; }
    const id = window.setInterval(() => {
      try { setQ(Math.round(level() * 10) / 10); } catch { setQ(0); }
    }, 90);
    return () => window.clearInterval(id);
  }, [enabled]);
  return q;
}

/**
 * Full-window ambient gradient rendered by shadergradient. It sits behind the whole app,
 * cross-fades between mode palettes, and speeds up and swells with the audio level.
 */
function Aurora({ mode }: { mode: Mode | null }) {
  const [c1, c2, c3] = useBlendedPalette(AURORA[mode ?? 'tts']);
  const energy = useAudioEnergy(mode !== null);
  return (
    <div className="aurora" aria-hidden="true">
      <ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={0.7} fov={45} pointerEvents="none" powerPreference="low-power">
        <ShaderGradient
          type="plane" animate="on" grain="off" lightType="3d" envPreset="city"
          color1={c1} color2={c2} color3={c3}
          brightness={1.15 + energy * 0.5} reflection={0.1}
          uSpeed={0.12 + energy * 0.4} uStrength={3 + energy * 1.6} uDensity={1.9 + energy * 0.4} uFrequency={5.5} uAmplitude={0}
          cAzimuthAngle={180} cPolarAngle={90} cDistance={4.4} cameraZoom={1}
          positionX={-1.4} positionY={0} positionZ={0}
          rotationX={0} rotationY={10} rotationZ={50}
        />
      </ShaderGradientCanvas>
    </div>
  );
}

export default memo(Aurora);
