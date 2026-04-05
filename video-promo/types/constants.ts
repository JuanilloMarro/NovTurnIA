import { z } from "zod";

export const COMP_NAME = "NovTurnIA";

export const CompositionProps = z.object({
  title: z.string(),
});

export const defaultMyCompProps: z.infer<typeof CompositionProps> = {
  title: "NovTurnIA",
};

// ~48 seconds × 60fps ≈ 2940 frames (TransitionSeries subtracts overlaps)
export const DURATION_IN_FRAMES = 3000;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1350;
export const VIDEO_FPS = 60;

// Design tokens — mirrors NovTurnIA system
export const COLORS = {
  navy900: "#0F2044",
  navy700: "#1A3A6B",
  navy500: "#1D5FAD",
  navy300: "#5B8AC4",
  navy100: "#EBF2FB",
  navy50: "#F5F8FD",
  primary: "#1D5FAD",
  green500: "#10B981",
  white: "#FFFFFF",
  glass: "rgba(255,255,255,0.75)",
  glassBorder: "rgba(255,255,255,0.60)",
  glassPremium: "rgba(255,255,255,0.65)",
};
