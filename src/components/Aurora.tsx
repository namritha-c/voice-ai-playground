'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { memo, useEffect, useRef } from 'react';
import { level } from '../lib/audio';

/**
 * The shader draws a neutral grey field and never receives a changing prop: shadergradient builds a new
 * material, and recompiles its shader, on every re-render. Mode colour comes from CSS tint layers above it
 * (see `.aurora-tint`), which the compositor cross-fades for free.
 */
const Field = memo(function Field() {
  return (
    <ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={0.7} fov={45} pointerEvents="none" powerPreference="low-power">
      <ShaderGradient
        type="plane" animate="on" grain="off" lightType="3d" envPreset="city"
        color1="#727272" color2="#0a0a0a" color3="#9c9c9c"
        brightness={1} reflection={0.1}
        uSpeed={0.16} uStrength={3} uDensity={1.9} uFrequency={5.5} uAmplitude={0}
        cAzimuthAngle={180} cPolarAngle={90} cDistance={4.4} cameraZoom={1}
        positionX={-1.4} positionY={0} positionZ={0}
        rotationX={0} rotationY={10} rotationZ={50}
      />
    </ShaderGradientCanvas>
  );
});

/** Full-window ambient gradient. The accent glow swells with the audio level, written straight to the DOM. */
function Aurora() {
  const glow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || !glow.current) return;
      try { glow.current.style.opacity = level().toFixed(2); } catch { glow.current.style.opacity = '0'; }
    }, 70);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="aurora" aria-hidden="true">
      <Field />
      <div className="aurora-tint" />
      <div className="aurora-tint b" />
      <div className="aurora-glow" ref={glow} />
    </div>
  );
}

export default memo(Aurora);
