"use client";

import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import type { ScoreItem } from "@/lib/live-data";
import { canDisplayScore, displayScoreValue, reconciliationMessage } from "@/lib/score-integrity";

type EventCardProps = {
  score: ScoreItem;
  compact?: boolean;
  cup?: boolean;
  showSport?: boolean;
};

function dateAndTime(dateValue: string | null) {
  if (!dateValue) return "Data a confirmar";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function eventPhase(score: ScoreItem) {
  if (score.integrity === "reconciling") return "EM RECONCILIAÇÃO";
  if (score.state === "in") return "AO VIVO";
  if (score.state === "post") return "ENCERRADO";
  if (score.state === "pre") return score.eventKind === "race" ? "PRÓXIMO GP" : "EM BREVE";
  return score.status;
}

function googleCalendarUrl(score: ScoreItem) {
  if (!score.startTime) return null;
  const start = new Date(score.startTime);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + (score.eventKind === "race" ? 2 * 60 * 60_000 : 2 * 60 * 60_000));
  const compact = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const title = score.eventKind === "race" ? `${score.home.name} · Fórmula 1` : `${score.home.name} x ${score.away.name}`;
  const details = `${score.league}${score.round ? ` · ${score.round}` : ""}
Acompanhe na LAP: https://lap-live-sports.vercel.app${eventHref(score)}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${compact(start)}/${compact(end)}`, details, location: score.venue || "" });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function eventHref(score: ScoreItem) {
  const worldCup = score.isWorldCup ? "?torneio=copa-2026" : "";
  return `/jogos/${score.sportId}/${score.id}${worldCup}`;
}

export function EventCard({ score, compact = false, cup = false, showSport = false }: EventCardProps) {
  const href = eventHref(score);
  const label = score.eventKind === "race" ? `${score.home.name} · Fórmula 1` : `${score.home.name} x ${score.away.name}`;
  const calendarUrl = score.state === "pre" ? googleCalendarUrl(score) : null;
  const showScore = canDisplayScore(score);
  const reconciliation = reconciliationMessage(score);
  const timeLabel = score.state === "post" ? score.status : score.startTime ? dateAndTime(score.startTime) : null;

  return (
    <article className={`event-card ${compact ? "event-card--compact" : ""} ${cup ? "event-card--cup" : ""} ${reconciliation ? "event-card--reconciling" : ""}`}>
      <Link href={href} className="event-card__clickarea" aria-label={`Abrir central do jogo: ${label}`}>
        <div className="event-card__meta">
          <span className={score.state === "in" && !reconciliation ? "live-label" : "status-label"}>{eventPhase(score)}</span>
          <span>{showSport ? `${score.sportId} · ${score.round || score.league.replace(/-/g, " ")}` : score.round || score.league.replace(/-/g, " ")}</span>
        </div>
        <div className="event-card__teams">
          <div className="team-line">
            <span>{score.home.logo && <img src={score.home.logo} alt="" width="22" height="22" />} {score.home.name}</span>
            <strong>{displayScoreValue(score, "home")}</strong>
          </div>
          {!showScore && score.eventKind !== "race" && <span className="event-card__versus">vs</span>}
          <div className="team-line">
            <span>{score.away.logo && <img src={score.away.logo} alt="" width="22" height="22" />} {score.away.name}</span>
            <strong>{displayScoreValue(score, "away")}</strong>
          </div>
        </div>
        {reconciliation && <p className="event-card__integrity">{reconciliation}</p>}
        <div className="event-card__footer">
          {timeLabel && <p className="event-card__time">{timeLabel}</p>}
          {score.venue && <p className="event-card__venue">{score.venue}</p>}
        </div>
      </Link>
      {calendarUrl && <a className="event-card__calendar" href={calendarUrl} target="_blank" rel="noreferrer" aria-label={`Adicionar ${label} ao Google Calendar`} title="Adicionar ao Google Calendar">＋</a>}
      <FavoriteButton id={`event:${score.sportId}:${score.id}`} type="event" label={label} href={href} className="event-card__favorite" />
    </article>
  );
}
