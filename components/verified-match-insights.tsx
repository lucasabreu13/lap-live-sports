import "server-only";

import type { ScoreItem } from "@/lib/live-data";
import styles from "./verified-match-insights.module.css";

type InsightProps = {
  event: ScoreItem;
};

type Prediction = { label: string; value: number };
type Fact = { label: string; value: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace("%", ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizePercentage(value: number | null) {
  if (value === null) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized * 10) / 10));
}

function parsePredictions(json: unknown, event: ScoreItem): Prediction[] {
  const root = record(json);
  const predictor = record(root.predictor);
  const homeTeam = record(predictor.homeTeam);
  const awayTeam = record(predictor.awayTeam);
  const home = normalizePercentage(numberValue(homeTeam.gameProjection, homeTeam.projectedWinPercentage, predictor.homeTeamPercentage));
  const away = normalizePercentage(numberValue(awayTeam.gameProjection, awayTeam.projectedWinPercentage, predictor.awayTeamPercentage));

  if (home !== null && away !== null) {
    const total = home + away;
    const safeHome = total > 0 ? Math.round((home / total) * 1000) / 10 : home;
    const safeAway = total > 0 ? Math.round((away / total) * 1000) / 10 : away;
    return [
      { label: event.home.name, value: safeHome },
      { label: event.away.name, value: safeAway },
    ];
  }

  const winProbability = array(root.winprobability).map(record);
  const latest = winProbability.at(-1);
  const homeChance = normalizePercentage(numberValue(latest?.homeWinPercentage));
  if (homeChance !== null) {
    return [
      { label: event.home.name, value: homeChance },
      { label: event.away.name, value: Math.round((100 - homeChance) * 10) / 10 },
    ];
  }

  return [];
}

function parseHeadToHead(json: unknown): Fact[] {
  const root = record(json);
  const seasonSeries = array(root.seasonseries).map(record);
  const facts: Fact[] = [];

  for (const series of seasonSeries) {
    const summary = text(series.summary, series.title, series.description);
    if (summary) facts.push({ label: "Confronto na temporada", value: summary });
    for (const event of array(series.events).map(record).slice(-5)) {
      const date = text(event.date);
      const name = text(event.shortName, event.name);
      const status = text(record(record(event.status).type).shortDetail, record(record(event.status).type).detail);
      if (name && status) facts.push({ label: date ? new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Último encontro", value: `${name} · ${status}` });
    }
  }

  return facts.slice(0, 6);
}

function parseVerifiedStats(json: unknown): Fact[] {
  const root = record(json);
  const header = record(root.header);
  const competition = record(array(header.competitions)[0]);
  const competitors = array(competition.competitors).map(record);
  const facts: Fact[] = [];

  for (const competitor of competitors) {
    const team = record(competitor.team);
    const teamName = text(team.displayName, team.shortDisplayName, team.abbreviation);
    const records = array(competitor.record).map(record);
    const campaign = records.map((item) => text(item.displayValue, item.summary)).find(Boolean);
    if (teamName && campaign) facts.push({ label: `${teamName} · campanha`, value: campaign });

    for (const stat of array(competitor.statistics).map(record).slice(0, 4)) {
      const label = text(stat.displayName, stat.label, stat.name);
      const value = text(stat.displayValue, stat.value);
      if (teamName && label && value) facts.push({ label: `${teamName} · ${label}`, value });
    }
  }

  const odds = record(array(root.odds)[0]);
  const details = text(odds.details);
  const overUnder = text(odds.overUnder);
  if (details) facts.push({ label: "Linha informativa do provedor", value: details });
  if (overUnder) facts.push({ label: "Total projetado pelo provedor", value: overUnder });

  return facts.slice(0, 10);
}

async function loadSummary(event: ScoreItem) {
  if (!event.providerPath || !event.id) return null;
  const url = `https://site.api.espn.com/apis/site/v2/sports/${event.providerPath}/summary?event=${encodeURIComponent(event.id)}`;
  try {
    const response = await fetch(url, { next: { revalidate: 300 }, headers: { "user-agent": "LAP Live Sports/1.0" } });
    if (!response.ok) return null;
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export async function VerifiedMatchInsights({ event }: InsightProps) {
  if (event.state === "post" || !event.providerPath) return null;
  const summary = await loadSummary(event);
  if (!summary) return null;

  const predictions = parsePredictions(summary, event);
  const headToHead = parseHeadToHead(summary);
  const stats = parseVerifiedStats(summary);
  if (!predictions.length && !headToHead.length && !stats.length) return null;

  return (
    <section className={styles.section} aria-labelledby="verified-insights-title">
      <header className={styles.heading}>
        <div><p>Dados do confronto</p><h2 id="verified-insights-title">Análise pré-jogo verificada</h2></div>
        <span>Os blocos abaixo aparecem somente quando o provedor disponibiliza dados reais para este evento.</span>
      </header>
      <div className={styles.grid}>
        {predictions.length ? <article className={styles.card}>
          <p>Projeção do provedor</p><h3>Probabilidade estimada</h3>
          <div className={styles.predictionRows}>{predictions.map((item) => <div className={styles.predictionRow} key={item.label}><span>{item.label}</span><div className={styles.bar}><span style={{ width: `${item.value}%` }} /></div><strong>{item.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong></div>)}</div>
          <div className={styles.note}>Estimativa estatística fornecida pela fonte do evento. Não representa certeza de resultado nem recomendação de aposta.</div>
        </article> : null}

        {headToHead.length ? <article className={styles.card}>
          <p>Retrospecto disponível</p><h3>Confrontos recentes</h3>
          <ul className={styles.list}>{headToHead.map((item, index) => <li key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></li>)}</ul>
        </article> : null}

        {stats.length ? <article className={styles.card}>
          <p>Base factual</p><h3>Estatísticas e contexto</h3>
          <ul className={styles.list}>{stats.map((item, index) => <li key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></li>)}</ul>
          <div className={styles.note}>Linhas e totais, quando exibidos, são apenas informação do provedor e podem mudar até o início do evento.</div>
        </article> : null}
      </div>
    </section>
  );
}
