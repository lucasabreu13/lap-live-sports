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
};

export function readNotificationPreferences(): NotificationPreferences {
  if (!canUseStorage()) return { enabled: false, favoriteOnly: true };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTIFICATION_KEY) || "{}") as Partial<NotificationPreferences>;
    return { enabled: Boolean(parsed.enabled), favoriteOnly: parsed.favoriteOnly !== false };
  } catch {
    return { enabled: false, favoriteOnly: true };
  }
}

export function writeNotificationPreferences(preferences: NotificationPreferences) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(preferences));
}
