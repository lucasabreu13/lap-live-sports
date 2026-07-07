"use client";

import { useEffect, useState } from "react";
import { isFavorite, subscribeFavorites, toggleFavorite } from "@/lib/client-preferences";

type FavoriteButtonProps = {
  id: string;
  type: "sport" | "event" | "league" | "team";
  label: string;
  href: string;
  className?: string;
};

export function FavoriteButton({ id, type, label, href, className = "" }: FavoriteButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(isFavorite(id));
    sync();
    return subscribeFavorites(sync);
  }, [id]);

  function onToggle() {
    setActive(toggleFavorite({ id, type, label, href }));
  }

  return (
    <button
      type="button"
      className={`favorite-button ${active ? "favorite-button--active" : ""} ${className}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `Remover ${label} dos favoritos` : `Adicionar ${label} aos favoritos`}
      title={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <span aria-hidden>{active ? "★" : "☆"}</span>
    </button>
  );
}
