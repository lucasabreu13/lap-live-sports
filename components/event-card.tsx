"use client";

import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import { GameAlertButton } from "@/components/game-alert-button";
import type { ScoreItem } from "@/lib/live-data";

type EventCardProps = {
  score: ScoreItem;
  compact?: boolean;
  cup?: boolean;
  showSport?: boolean;
  onPreview?: () => void;
};

function eventPhase(score: ScoreItem) {
  if (score.state === "in") return "AO VIVO";
  if (score.state === "post") return "ENCERRADO";
  if (score.state === "pre") return score.eventKind === "race" ? "PRÃ“XIMO GP" : "EM BREVE";
  return score.status || "ATUALIZAÃ‡ÃƒO";
}

function eventId(score: ScoreItem) {
  return `event:${score.sportId}:${score.id}`;
}

function dateAndTime(dateValue: string | null) {
  if (!dateValue) return "Data a confirmar";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Data a confirmar";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function scheduleText(score: ScoreItem) {
  if (score.state === "in") return score.status || "Ao vivo";
  if (score.state === "post") return `Final Â· ${score.status || "Encerrado"}`;
  if (!score.startTime) return "HorÃ¡rio a confirmar";

  const start = new Date(score.startTime);
  const minutes = Math.round((start.getTime() - Date.now()) / 60_000);
  if (minutes >= 0 && minutes <= 60) return `ComeÃ§a em ${minutes} min`;

  return dateAndTime(score.startTime);
}

function googleCalendarUrl(score: ScoreItem) {
  if (!score.startTime) return null;
  const start = new Date(score.startTime);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  const compact = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const title = score.eventKind === "race" ? `${score.home.name} Â· FÃ³rmula 1` : `${score.home.name} x ${score.away.name}`;
  const details = `${score.league}${score.round ? ` Â· ${score.round}` : ""}\nAcompanhe na LAP: https://lap-live-sports.vercel.app${eventHref(score)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${compact(start)}/${compact(end)}`,
    details,
    location: score.venue || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function eventHref(score: ScoreItem) {
  const worldCup = score.isWorldCup ? "?torneio=copa-2026" : "";
  return `/jogos/${score.sportId}/${score.id}${worldCup}`;
}

export function EventCard({ score, compact = false, cup = false, showSport = false, onPreview }: EventCardProps) {
  const href = eventHref(score);
  const label = score.eventKind === "race" ? `${score.home.name} Â· FÃ³rmula 1` : `${score.home.name} x ${score.away.name}`;
  const calendarUrl = score.state === "pre" ? googleCalendarUrl(score) : null;
  const competition = [score.league, score.round].filter(Boolean).join(" Â· ");

  return (
    <article className={`event-card event-card--rich ${compact ? "event-card--compact" : ""} ${cup ? "event-card--cup" : ""}`}>
      <div className="event-card__body">
        <Link href={href} className="event-card__clickarea" aria-label={`Abrir detalhes: ${label}`}>
          <div className="event-card__meta">
            <span className={score.state === "in" ? "live-label" : "status-label"}>{eventPhase(score)}</span>
            <span>{showSport ? `${score.sportId.replace(/-/g, " ")} Â· ${score.round || score.league}` : score.round || score.league}</span>
          </div>

          <div className="event-card__teams">
            <div className="team-line">
              <span>{score.home.logo && <img src={score.home.logo} alt="" width="24" height="24" />} {score.home.name}</span>
              <strong>{score.home.score ?? "â€”"}</strong>
            </div>
            <div className="team-line">
              <span>{score.away.logo && <img src={score.away.logo} alt="" width="24" height="24" />} {score.away.name}</span>
              <strong>{score.away.score ?? "â€”"}</strong>
            </div>
          </div>
        </Link>

        <div className="event-card__actions">
          {score.state !== "post" && <GameAlertButton eventId={eventId(score)} label={label} className="event-card__alert" />}
          <FavoriteButton id={eventId(score)} type="event" label={label} href={href} className="event-card__favorite" />
        </div>
      </div>

      <div className="event-card__context">
        <span>{competition || "CompetiÃ§Ã£o em atualizaÃ§Ã£o"}</span>
        {score.venue && <span>{score.venue}</span>}
        {score.broadcast && <span>TransmissÃ£o: {score.broadcast}</span>}
      </div>

      <footer className="event-card__footer">
        <p className="event-card__time">{scheduleText(score)}</p>
        <div className="event-card__footer-actions">
          {calendarUrl && <a className="event-card__calendar" href={calendarUrl} target="_blank" rel="noreferrer">Agenda</a>}
          {onPreview && <button type="button" className="event-card__preview" onClick={onPreview}>Resumo</button>}
          <Link href={href} className="event-card__details">Detalhes</Link>
        </div>
      </footer>
    </article>
  );
}