"use client";

export type FavoriteItem = {
  id: string;
  type: "sport" | "event" | "league" | "team";
  label: string;
  href: string;
  createdAt: string;
};

const FAVORITES_KEY = "lap:favorites:v1";
const NOTIFICATION_KEY = "lap:notifications:v1";
const DEVICE_ID_KEY = "lap:device-installation:v1";
const FAVORITES_EVENT = "lap:favorites:changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readFavorites(): FavoriteItem[] {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]") as FavoriteItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.href === "string") : [];
  } catch {
    return [];
  }
}

function writeFavorites(items: FavoriteItem[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(FAVORITES_EVENT));
  void syncPushPreferences();
}

export function toggleFavorite(item: Omit<FavoriteItem, "createdAt">) {
  const current = readFavorites();
  const exists = current.some((favorite) => favorite.id === item.id);
  const next = exists ? current.filter((favorite) => favorite.id !== item.id) : [{ ...item, createdAt: new Date().toISOString() }, ...current].slice(0, 40);
  writeFavorites(next);
  return !exists;
}

export function isFavorite(id: string) {
  return readFavorites().some((item) => item.id === id);
}

export function subscribeFavorites(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(FAVORITES_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export type NotificationPreferences = {
  enabled: boolean;
  favoriteOnly: boolean;
  preGame: boolean;
  start: boolean;
  score: boolean;
  lineup: boolean;
  halftime: boolean;
  resume: boolean;
  final: boolean;
  editorial: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  favoriteOnly: true,
  preGame: true,
  start: true,
  score: true,
  lineup: true,
  halftime: true,
  resume: true,
  final: true,
  editorial: true,
};

export function readNotificationPreferences(): NotificationPreferences {
  if (!canUseStorage()) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTIFICATION_KEY) || "{}") as Partial<NotificationPreferences>;
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
      enabled: Boolean(parsed.enabled),
      favoriteOnly: parsed.favoriteOnly !== false,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function writeNotificationPreferences(preferences: Partial<NotificationPreferences>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(NOTIFICATION_KEY, JSON.stringify({ ...readNotificationPreferences(), ...preferences }));
}

export function getDeviceInstallationId() {
  if (!canUseStorage()) return "";
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length >= 12) return existing;
  const next = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `lap-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function favoriteIds() {
  return readFavorites().map((item) => item.id);
}

export async function syncPushSubscription(subscription: PushSubscription) {
  const deviceId = getDeviceInstallationId();
  if (!deviceId) throw new Error("Dispositivo não disponível.");
  const preferences = { ...readNotificationPreferences(), enabled: true };
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      subscription: subscription.toJSON(),
      preferences,
      favoriteIds: favoriteIds(),
    }),
  });
  if (!response.ok) throw new Error("Não foi possível salvar a assinatura Push.");
  writeNotificationPreferences({ enabled: true });
}

export async function syncPushPreferences() {
  if (typeof window === "undefined") return;
  const preferences = readNotificationPreferences();
  if (!preferences.enabled) return;
  const deviceId = getDeviceInstallationId();
  if (!deviceId) return;
  await fetch("/api/push/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      preferences,
      favoriteIds: favoriteIds(),
      enabled: preferences.enabled,
    }),
  }).catch(() => undefined);
}

export async function unsubscribePushDevice(endpoint?: string | null) {
  const deviceId = getDeviceInstallationId();
  await fetch("/api/push/unsubscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, endpoint }),
  }).catch(() => undefined);
  writeNotificationPreferences({ enabled: false });
}
