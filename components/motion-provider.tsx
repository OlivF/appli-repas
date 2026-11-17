"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Les animations se coupent quand le téléphone demande « réduire les animations ».
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
