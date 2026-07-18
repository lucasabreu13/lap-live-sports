"use client";

import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import { eventDisplayTitle, eventPreLabel, isSingleEvent } from "@/lib/event-presentation";
import type { ScoreItem } from "@/lib/live-data";
import { canDisplayScore, displayScoreValue } from "@/lib/score-integrity";
import styles from "./event-card.module.css";

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
  if (score.state === "in") return "AO VIVO";
  if (score.state === "post") return "ENCERRADO";
  if (score.state === "pre") return eventPreLabel(score);
  return score.status;
}

function teamInitials(name: string) {
  const parts = name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return "LAP";
  const relevant = parts.filter((part) => !["fc", "cf", "sc", "ac", "ec", "the", "de", "da", "do", "dos"].includes(part.toLowerCase()));
  const seed = relevant.length ? relevant : parts;
  return seed.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LAP";
}

function TeamLogo({ logo, name }: { logo?: string | null; name: string }) {
  return (
    <span className={styles.teamLogo} aria-hidden="true">
      {logo ? <img src={logo} alt="" width="30" height="30" loading="lazy" /> : <span className={styles.teamInitials}>{teamInitials(name)}</span>}
    </span>
  );
}

function TeamLine({ logo, name, scoreValue }: { logo?: string | null; name: string; scoreValue: string }) {
  return (
    <div className={`team-line ${styles.teamLine}`}>
      <span className={styles.teamIdentity}>
        <TeamLogo logo={logo} name={name} />
        <span className={styles.teamName}>{name}</span>
      </span>
      <strong className={styles.score}>{scoreValue}</strong>
    </div>
  );
}

function googleCalendarUrl(score: ScoreItem) {
  if (!score.startTime) return null;
  const start = new Date(score.startTime);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  const compact = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const title = eventDisplayTitle(score);
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
  const label = eventDisplayTitle(score);
  const calendarUrl = score.state === "pre" ? googleCalendarUrl(score) : null;
  const showScore = canDisplayScore(score);
  const timeLabel = score.state === "post" ? score.status : score.startTime ? dateAndTime(score.startTime) : null;
  const isLive = score.state === "in";
  const singleEvent = isSingleEvent(score);

  return (
    <article className={`event-card ${styles.premiumCard} ${isLive ? styles.liveCard : ""} ${compact ? `event-card--compact ${styles.compact}` : ""} ${cup ? "event-card--cup" : ""}`}>
      <Link href={href} className="event-card__clickarea" aria-label={`Abrir central do jogo: ${label}`}>
        <div className="event-card__meta">
          <span className={isLive ? "live-label" : "status-label"}>{eventPhase(score)}</span>
          <span>{showSport ? `${score.sportId} · ${score.round || score.league.replace(/-/g, " ")}` : score.round || score.league.replace(/-/g, " ")}</span>
        </div>
        {singleEvent ? (
          <div className={styles.singleEvent}>
            <TeamLogo logo={score.home.logo} name={score.home.name} />
            <strong>{score.home.name}</strong>
            <span>{score.league.replace(/-/g, " ")}</span>
          </div>
        ) : (
          <div className={`event-card__teams ${styles.teams}`}>
            <TeamLine logo={score.home.logo} name={score.home.name} scoreValue={displayScoreValue(score, "home")} />
            {!showScore && <span className="event-card__versus">vs</span>}
            <TeamLine logo={score.away.logo} name={score.away.name} scoreValue={displayScoreValue(score, "away")} />
          </div>
        )}
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
