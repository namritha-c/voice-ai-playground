'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { memo, useEffect, useState } from 'react';
import type { Mode } from '../api/client';
import { level } from '../lib/audio';
import { useBlendedPalette } from '../lib/color';

/** Dark, saturated triads per mode. The first colour carries the mode accent, the rest keep the field moody. */
export const AURORA: Record<Mode, readonly [string, string, string]> = {
  tts: ['#ff6a2b', '#8a1f0e', '#1d0a06'],
  stt: ['#a6e35a', '#1d6a3a', '#06140b'],
  sts: ['#b9a2ff', '#4a2aa8', '#0a0618'],
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
          type="waterPlane" animate="on" grain="on" lightType="3d" envPreset="city"
          color1={c1} color2={c2} color3={c3}
          brightness={1.05 + energy * 0.5} reflection={0.1}
          uSpeed={0.16 + energy * 0.45} uStrength={2.8 + energy * 2.2} uDensity={1.2} uFrequency={0} uAmplitude={0}
          cAzimuthAngle={170} cPolarAngle={70} cDistance={4.4} cameraZoom={1}
          positionX={0} positionY={0.9} positionZ={-0.3}
          rotationX={45} rotationY={0} rotationZ={0}
        />
      </ShaderGradientCanvas>
    </div>
  );
}

export default memo(Aurora);
