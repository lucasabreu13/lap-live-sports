import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { LiveScoresTransition } from "@/components/live-scores-transition";
import { getCachedLivePayload } from "@/lib/free-live-data";
import { toPublicLivePayload } from "@/lib/public-sports";
import type { ScoreItem } from "@/lib/live-data";
import styles from "@/components/live-scores-hub.module.css";

export const metadata: Metadata = {
  title: "Ao Vivo",
  description: "Central ao vivo da LAP com jogos em andamento, agenda de hoje, próximos eventos e resultados verificados.",
};

function eventTime(event: ScoreItem) {
  const value = event.startTime ? new Date(event.startTime).getTime() : Number.NaN;
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function updatedAt(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

export default async function LivePage() {
  const rawPayload = await getCachedLivePayload({ preferCached: true }).catch(() => null);
  const payload = rawPayload ? toPublicLivePayload(rawPayload) : null;
  const events = payload ? Array.from(new Map(payload.feeds.flatMap((feed) => feed.scores).map((event) => [`${event.sportId}:${event.id}`, event])).values()) : [];
  const live = events.filter((event) => event.state === "in").sort((a, b) => eventTime(a) - eventTime(b));
  const upcoming = events.filter((event) => event.state === "pre").sort((a, b) => eventTime(a) - eventTime(b));
  const recent = events.filter((event) => event.state === "post").sort((a, b) => eventTime(b) - eventTime(a));
  const visible = (live.length ? live : upcoming.length ? upcoming : recent).slice(0, 12);
  const stamp = updatedAt(payload?.generatedAt);

  const initialSnapshot = (
    <main>
      <LapHeader />
      <div className={`shell ${styles.page}`}>
        <section className={styles.hero}>
          <div><p>Central de partidas</p><h1>Ao Vivo</h1><span>Placar, agenda e resultados carregados no primeiro HTML da página.</span></div>
          <aside><strong>{live.length}</strong><span>eventos ao vivo</span>{stamp ? <small>Dados atualizados às {stamp}</small> : null}</aside>
        </section>
        {visible.length ? <section>
          <div className={styles.eventsPane} aria-label={live.length ? "Eventos ao vivo" : upcoming.length ? "Próximos eventos" : "Resultados recentes"}>
            <header><div><p>{live.length ? "Tempo real" : upcoming.length ? "Próximos" : "Resultados"}</p><h2>{visible.length} na central</h2></div>{stamp ? <span>{stamp}</span> : null}</header>
            <div className="full-schedule__grid">{visible.map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} showSport />)}</div>
          </div>
        </section> : <section className={styles.noEvents}><strong>Nenhum evento disponível neste snapshot.</strong><p>Consulte a agenda para ampliar o período.</p><Link href="/agenda">Abrir agenda</Link></section>}
      </div>
    </main>
  );

  return <LiveScoresTransition initialSnapshot={initialSnapshot} />;
}
