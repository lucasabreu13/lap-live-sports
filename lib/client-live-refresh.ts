type RefreshOptions = {
  intervalMs: number;
  minimumGapMs?: number;
};

export function subscribeToLiveRefresh(refresh: () => void | Promise<void>, options: RefreshOptions) {
  const minimumGapMs = options.minimumGapMs ?? 1_500;
  let lastRefreshAt = 0;

  const trigger = () => {
    if (document.visibilityState === "hidden") return;
    const now = Date.now();
    if (now - lastRefreshAt < minimumGapMs) return;
    lastRefreshAt = now;
    void refresh();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") trigger();
  };
  const onServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type === "lap:push") trigger();
  };

  const interval = window.setInterval(trigger, options.intervalMs);
  window.addEventListener("focus", trigger);
  window.addEventListener("online", trigger);
  document.addEventListener("visibilitychange", onVisibility);
  navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", trigger);
    window.removeEventListener("online", trigger);
    document.removeEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
  };
}
