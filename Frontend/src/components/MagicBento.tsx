import React from "react";
import { cn } from "@/lib/utils";

export interface BentoProps {
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  enableTilt?: boolean;
  glowColor?: string;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
}

interface MagicBentoProps extends BentoProps {
  children: React.ReactNode;
  className?: string;
}

const DEFAULT_SPOTLIGHT_RADIUS = 360;
const DEFAULT_GLOW_COLOR = "0, 212, 255";

const MagicBento = ({
  children,
  className,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowColor = DEFAULT_GLOW_COLOR,
}: MagicBentoProps) => {
  return (
    <div
      className={cn(
        "magic-bento-scope",
        disableAnimations && "magic-hover--disabled",
        className,
      )}
      style={{
        "--magic-glow": glowColor,
        "--magic-glow-radius": `${spotlightRadius}px`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export default MagicBento;
