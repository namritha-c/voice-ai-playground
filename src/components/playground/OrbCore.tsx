'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { memo } from 'react';
import { shade, useBlendedPalette } from '../../lib/color';
import type { Energy } from './Hero';

/** A liquid gradient sphere that sits under the dot lattice and gives the orb a lit, glassy body. */
function OrbCore({ accent, energy }: { accent: string; energy: Energy }) {
  const [c1, c2, c3] = useBlendedPalette([accent, shade(accent, 0.55), shade(accent, 0.9)] as const);
  const hot = energy === 'live' ? 1 : energy === 'busy' ? 0.6 : 0;
  return (
    <div className="orb-core" aria-hidden="true">
      <ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={1.4} fov={45} pointerEvents="none" powerPreference="low-power">
        <ShaderGradient
          type="sphere" animate="on" grain="off" lightType="3d" envPreset="city"
          color1={c1} color2={c2} color3={c3}
          brightness={0.9 + hot * 0.4} reflection={0.35}
          uSpeed={0.2 + hot * 0.4} uStrength={0.5 + hot * 0.5} uDensity={0.9} uFrequency={5.5} uAmplitude={3.2}
          cAzimuthAngle={270} cPolarAngle={180} cDistance={0.5} cameraZoom={15.1}
          positionX={-0.1} positionY={0} positionZ={0}
          rotationX={0} rotationY={130} rotationZ={70}
        />
      </ShaderGradientCanvas>
    </div>
  );
}

export default memo(OrbCore);
