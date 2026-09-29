'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { memo, useEffect, useState } from 'react';
import type { Energy } from './Hero';

/** Constant props on purpose: a prop change makes shadergradient recompile its shader. Colour and energy are CSS. */
const Sphere = memo(function Sphere() {
  return (
    <ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={1.4} fov={45} pointerEvents="none" powerPreference="low-power">
      <ShaderGradient
        type="sphere" animate="on" grain="off" lightType="3d" envPreset="city"
        color1="#5e5e5e" color2="#1e1e1e" color3="#070707"
        brightness={0.9} reflection={0.35}
        uSpeed={0.3} uStrength={0.7} uDensity={0.9} uFrequency={5.5} uAmplitude={3.2}
        cAzimuthAngle={270} cPolarAngle={180} cDistance={0.5} cameraZoom={15.1}
        positionX={-0.1} positionY={0} positionZ={0}
        rotationX={0} rotationY={130} rotationZ={70}
      />
    </ShaderGradientCanvas>
  );
});

/** A liquid gradient sphere under the dot lattice. It mounts after the tab switch settles, so the shader compile never lands on it. */
function OrbCore({ energy }: { energy: Energy }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 700);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="orb-core" data-energy={energy} aria-hidden="true">
      {ready && <Sphere />}
    </div>
  );
}

export default memo(OrbCore);
