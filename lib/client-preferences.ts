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
const NOTIFICATIONS_EVENT = "lap:notifications:changed";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readFavorites(): FavoriteItem[] {
  if (!canUseStorage()) return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]") as FavoriteItem[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.href === "string")
      : [];
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
  const next = exists
    ? current.filter((favorite) => favorite.id !== item.id)
    : [{ ...item, createdAt: new Date().toISOString() }, ...current].slice(0, 40);

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
  eventIds?: string[];
};

function normalizeEventIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 60)
    : [];
}

export function readNotificationPreferences(): NotificationPreferences {
  if (!canUseStorage()) return { enabled: false, favoriteOnly: true, eventIds: [] };

  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTIFICATION_KEY) || "{}") as Partial<NotificationPreferences>;
    return {
      enabled: Boolean(parsed.enabled),
      favoriteOnly: parsed.favoriteOnly !== false,
      eventIds: normalizeEventIds(parsed.eventIds),
    };
  } catch {
    return { enabled: false, favoriteOnly: true, eventIds: [] };
  }
}

export function writeNotificationPreferences(preferences: NotificationPreferences) {
  if (!canUseStorage()) return;

  const current = readNotificationPreferences();
  const next: NotificationPreferences = {
    enabled: preferences.enabled,
    favoriteOnly: preferences.favoriteOnly,
    eventIds: preferences.eventIds ?? current.eventIds ?? [],
  };

  window.localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
}

export function subscribeNotificationPreferences(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener(NOTIFICATIONS_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(NOTIFICATIONS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function isEventAlertEnabled(eventId: string) {
  return Boolean(readNotificationPreferences().eventIds?.includes(eventId));
}

export function toggleEventAlert(eventId: string) {
  const current = readNotificationPreferences();
  const eventIds = current.eventIds ?? [];
  const exists = eventIds.includes(eventId);

  writeNotificationPreferences({
    ...current,
    enabled: true,
    eventIds: exists
      ? eventIds.filter((item) => item !== eventId)
      : [eventId, ...eventIds].slice(0, 60),
  });

  return !exists;
}