"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { readNotificationPreferences, syncPushSubscription, unsubscribePushDevice, writeNotificationPreferences } from "@/lib/client-preferences";
import type { SportId } from "@/lib/live-data";
import { PUBLIC_SPORTS } from "@/lib/public-sports";

type LapHeaderProps = { activeSport?: SportId | "todos"; onRefresh?: () => void; isRefreshing?: boolean; compact?: boolean };
type SearchResult = { id: string; title: string; meta: string; href: string; kind: "matéria" | "jogo" | "modalidade" | "liga" | "time" | "atleta" };

function NotificationControl() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Ativar alertas para favoritos");

  useEffect(() => {
    const available = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    setSupported(available);
    if (!available) return;
    void navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      const active = readNotificationPreferences().enabled && Notification.permission === "granted" && Boolean(subscription);
      setEnabled(active);
      setLabel(active ? "Alertas ativos para favoritos" : "Ativar alertas para favoritos");
    }).catch(() => undefined);
  }, []);

  function normalizeVapidPublicKey(value: string) {
    const cleaned = value.trim().replace(/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/, "").replace(/^['\"]|['\"]$/g, "").replace(/\s/g, "");
    if (!cleaned || !/^[A-Za-z0-9_-]+$/.test(cleaned)) throw new Error("VAPID público inválido na Vercel");
    return cleaned;
  }

  function vapidKeyToUint8Array(value: string) {
    const cleaned = normalizeVapidPublicKey(value);
    const padding = "=".repeat((4 - cleaned.length % 4) % 4);
    const base64 = (cleaned + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    if (raw.length !== 65) throw new Error("VAPID público inválido na Vercel");
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
  }

  async function toggleAlerts() {
    if (!supported || busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      if (enabled) {
        const subscription = await registration.pushManager.getSubscription();
        await subscription?.unsubscribe().catch(() => false);
        await unsubscribePushDevice(subscription?.endpoint ?? null);
        setEnabled(false); setLabel("Alertas desativados"); return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) { setLabel("VAPID público ausente"); return; }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") { setLabel("Permissão negada pelo navegador"); return; }
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToUint8Array(publicKey) });
      writeNotificationPreferences({ enabled: true, favoriteOnly: true });
      await syncPushSubscription(subscription);
      setEnabled(true); setLabel("Alertas ativos para favoritos");
    } catch (error) {
      console.error("[LAP] Falha ao ativar Web Push", error);
      writeNotificationPreferences({ enabled: false }); setEnabled(false);
      const message = error instanceof Error && error.message ? error.message : "Falha ao ativar Web Push";
      setLabel(message.slice(0, 96));
    } finally { setBusy(false); }
  }

  if (!supported) return null;
  return <button type="button" className={`header-icon-button ${enabled ? "header-icon-button--active" : ""}`} onClick={() => void toggleAlerts()} title={enabled ? "Desativar alertas" : label} aria-pressed={enabled} disabled={busy}>{enabled ? "🔔" : "🔕"}</button>;
}

function InstallControl() {
  const [promptEvent, setPromptEvent] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const listener = (event: Event) => { event.preventDefault(); setPromptEvent(event); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", listener); window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => void registration.update()).catch(() => undefined);
    return () => { window.removeEventListener("beforeinstallprompt", listener); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  async function install() {
    const event = promptEvent as (Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }) | null;
    if (!event?.prompt) return;
    await event.prompt(); const choice = await event.userChoice; if (choice?.outcome === "accepted") setPromptEvent(null);
  }
  if (installed || !promptEvent) return null;
  return <button type="button" className="header-install" onClick={() => void install()}>Instalar</button>;
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setOpen(false); setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("search unavailable");
        const payload = await response.json() as { results?: SearchResult[] };
        setResults(payload.results || []); setOpen(true);
      } catch { if (!controller.signal.aborted) { setResults([]); setOpen(true); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <div className="site-search">
    <label className="sr-only" htmlFor="lap-search">Buscar na LAP</label>
    <input id="lap-search" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => query.trim().length >= 2 && setOpen(true)} placeholder="Buscar atleta, time, matéria ou competição" autoComplete="off" />
    <span className="site-search__icon" aria-hidden>{loading ? "…" : "⌕"}</span>
    {open && <div className="site-search__results" role="listbox" aria-label="Resultados da busca">
      {results.length ? results.map((result) => <Link key={result.id} href={result.href} className="site-search__result" onClick={() => { setOpen(false); setQuery(""); }}><span>{result.kind}</span><strong>{result.title}</strong>{result.meta ? <small>{result.meta}</small> : null}</Link>) : <p className="site-search__empty">Nenhum conteúdo encontrado.</p>}
    </div>}
  </div>;
}

export function LapHeader({ activeSport = "todos", onRefresh, isRefreshing = false }: LapHeaderProps) {
  return <>
    <header className="masthead"><div className="shell masthead__inside"><Link className="brand" href="/" aria-label="LAP, início"><span className="brand__mark">LAP</span><span className="brand__tag">live sports</span></Link><div className="masthead__tools"><SearchBox /><Link href="/favoritos" className="header-icon-button" title="Favoritos" aria-label="Abrir favoritos">★</Link><NotificationControl /><InstallControl />{onRefresh && <button className="refresh-button" type="button" onClick={onRefresh} disabled={isRefreshing}><span aria-hidden>↻</span> {isRefreshing ? "Atualizando" : "Atualizar"}</button>}</div></div></header>
    <nav className="sport-nav sport-nav--focused sport-nav--all-visible" aria-label="Navegação esportiva principal">
      <div className="shell sport-nav__inside">
        <Link href="/ao-vivo" className="sport-nav__agenda">Ao Vivo</Link>
        <Link href="/agenda" className="sport-nav__agenda">Agenda</Link>
        {PUBLIC_SPORTS.map((sport) => <Link href={`/modalidades/${sport.id}`} className={activeSport === sport.id ? "active" : ""} key={sport.id}>{sport.icon} {sport.name}</Link>)}
        <Link href="/college-football" className="sport-nav__college">🏈 College Football</Link>
      </div>
    </nav>
  </>;
}

export function SportFavoriteButton({ sportId }: { sportId: SportId }) {
  const sport = PUBLIC_SPORTS.find((item) => item.id === sportId);
  if (!sport) return null;
  return <FavoriteButton id={`sport:${sport.id}`} type="sport" label={sport.name} href={`/modalidades/${sport.id}`} className="sport-favorite-button" />;
}
