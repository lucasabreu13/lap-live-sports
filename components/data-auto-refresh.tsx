"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const REFRESH_MS = 2 * 60 * 1000;
const MIN_VISIBLE_GAP_MS = 45 * 1000;

export function DataAutoRefresh() {
  const router = useRouter();
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < MIN_VISIBLE_GAP_MS) return;
      lastRefresh.current = now;
      router.refresh();
    };

    const timer = window.setInterval(refresh, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onFocus = () => refresh();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [router]);

  return null;
}
