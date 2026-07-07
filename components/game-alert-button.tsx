"use client";

import { useEffect, useState } from "react";
import {
  isEventAlertEnabled,
  subscribeNotificationPreferences,
  toggleEventAlert,
} from "@/lib/client-preferences";

type GameAlertButtonProps = {
  eventId: string;
  label: string;
  className?: string;
};

export function GameAlertButton({ eventId, label, className = "" }: GameAlertButtonProps) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const sync = () => {
      setActive(isEventAlertEnabled(eventId));
      setBlocked("Notification" in window && Notification.permission === "denied");
    };

    setSupported("Notification" in window);
    sync();
    return subscribeNotificationPreferences(sync);
  }, [eventId]);

  async function handleToggle() {
    if (!("Notification" in window)) return;

    let permission = Notification.permission;
    if (permission !== "granted") permission = await Notification.requestPermission();

    if (permission !== "granted") {
      setBlocked(true);
      return;
    }

    setBlocked(false);
    setActive(toggleEventAlert(eventId));
  }

  if (!supported) return null;

  const text = blocked ? "Alertas bloqueados" : active ? "Alertas ativos" : "Me avise";

  return (
    <button
      type="button"
      className={`game-alert-button ${active ? "game-alert-button--active" : ""} ${className}`}
      onClick={() => void handleToggle()}
      aria-pressed={active}
      title={blocked ? "Libere as notificaÃ§Ãµes no navegador" : `${text}: ${label}`}
    >
      <span aria-hidden="true">{active ? "ðŸ””" : "ðŸ”•"}</span>
      {text}
    </button>
  );
}