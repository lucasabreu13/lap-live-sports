"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LiveScoresHub } from "@/components/live-scores-hub";

export function LiveScoresTransition({ initialSnapshot }: { initialSnapshot: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <LiveScoresHub /> : <>{initialSnapshot}</>;
}
