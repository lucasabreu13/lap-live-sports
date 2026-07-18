# LAP — Live Sports 2.0

A LAP é um portal esportivo em Next.js com páginas internas, central de jogos, hub da Copa do Mundo 2026, favoritos locais, PWA, alertas no navegador, agenda completa e núcleo editorial persistente.

## Principais entregas

### Cobertura e navegação

- **Páginas de modalidade:** cada esporte tem configuração editorial, calendário, classificação quando disponível, mapa de competições, notícias e guia próprios em `/modalidades/[sport]`.
- **Futebol mundial:** a central mapeia 25 competições, com destaque para Brasileirão A/B, Copa do Brasil, Libertadores, Champions League, Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, MLS, Liga MX e ligas sul-americanas.
- **Central de jogos:** `/jogos/[sport]/[id]` resolve eventos por caminho principal, histórico recente e caminhos alternativos da modalidade; mostra placar, situação, local, cronologia, estatísticas e escalações quando disponíveis.
- **Páginas de campeonato:** todas as 25 ligas mapeadas têm jogo em destaque, agenda, resultados, clubes, classificação estruturada quando publicada, indicadores e notícias.
- **Copa do Mundo 2026:** `/copa-2026` reúne a agenda, resultados, fase/chaveamento por partidas recebidas e um recorte específico da Seleção Brasileira.
- **Agenda geral:** `/agenda` permite filtrar partidas ao vivo, próximas e encerradas por data (hoje, amanhã e semana), modalidade, liga, time e competição; eventos futuros podem ser enviados ao Google Calendar.
- **Central Ao Vivo:** `/ao-vivo` é a central operacional com abas Ao vivo, Hoje, Amanhã e Resultados, filtros por modalidade/liga/favoritos/busca e agrupamento por campeonato.
- **Busca interna:** disponível no topo para modalidades, matérias, times e competições que estejam presentes no feed atual.
- **Favoritos:** `/favoritos` guarda modalidades, ligas e jogos neste dispositivo; eles são usados para concentrar a experiência e filtrar alertas.

### Atualização e alertas

- **Fallback de atualização:** a home, a agenda e os hubs consultam os dados a cada **30 segundos**.
- **Central de jogo ao vivo:** atualiza a cada 15 segundos como fallback durante partidas em andamento.
- **SSE:** `/api/live/stream` mantém um canal de eventos para entregar atualizações recebidas sem esperar o próximo polling.
- **Webhook do provedor:** `/api/live/webhook` aceita mudanças de placar autenticadas por `LAP_LIVE_WEBHOOK_TOKEN` e as envia para os clientes conectados na mesma instância.
- **Integridade de placares:** todo evento recebe `integrity: "verified" | "reconciling"` antes de ser renderizado. Placares conflitantes com status ou pré-jogo ficam ocultos até a próxima resposta válida.
- **Alertas persistentes:** o ícone de sino habilita Web Push real para favoritos salvos. O backend valida integridade, filtra favoritos, deduplica entregas no Supabase e o Service Worker abre a partida correta ao tocar na notificação.

### Editorial, SEO e operação

- **CMS editorial:** `/admin` suporta rascunhos, revisão, agendamento, publicação, arquivamento, autor, tags, imagem de capa, SEO e histórico de versões.
- **Papéis editoriais:** configure tokens independentes de `admin`, `editor` e `writer` no `.env.local`.
- **Monitoramento:** `/admin/monitoramento` consulta `/api/health` e mostra o estado das fontes em ciclos de 30 segundos.
- **SEO:** metadados, Open Graph, JSON-LD de matéria e evento esportivo, sitemap, robots e RSS em `/feed.xml`.
- **PWA:** manifest, ícone e service worker em `public/sw.js` para instalação no navegador compatível.
- **Resiliência:** quando uma fonte oscila, a LAP preserva a última resposta válida por até 20 minutos, informa o estado do feed no monitoramento e mantém guias editoriais próprios para evitar uma home vazia. A LAP não cria placares ou estatísticas fictícias.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Validações de produção:

```bash
npm run typecheck
npm run test:integrity
npm run test:data
npm run test:push
npm run build
```

Com o servidor local em execução, rode a auditoria de rotas, conteúdo e eventos com:

```bash
npm run audit:site -- http://localhost:3000
```

## Configurar variáveis

1. Copie `.env.example` para `.env.local`.
2. Defina `NEXT_PUBLIC_SITE_URL` com o domínio final.
3. Para conteúdo editorial persistente, configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
4. Gere tokens longos e distintos para `LAP_ADMIN_TOKEN`, `LAP_EDITOR_TOKEN`, `LAP_WRITER_TOKEN` e `LAP_LIVE_WEBHOOK_TOKEN`.
5. Gere VAPID com `npx web-push generate-vapid-keys` e configure `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`.
6. Configure `CRON_SECRET` para proteger `/api/push/monitor` e `/api/push/test`.
7. Reinicie o servidor.

## Banco editorial no Supabase

1. Crie um projeto Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Mantenha a `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no servidor.
4. Acesse `/admin` e informe o token adequado.

O schema inclui:

- `lap_articles`: artigos, SEO, autores, tags, agendamento e status;
- `lap_article_versions`: snapshots de criação e alterações;
- `lap_media`: catálogo simples de mídias/remotos autorizados para evoluir a biblioteca de imagens;
- `lap_push_subscriptions`: assinaturas Web Push por dispositivo;
- `lap_live_event_snapshots`: estado anterior dos eventos para detectar mudanças reais;
- `lap_push_deliveries`: histórico idempotente para impedir alerta duplicado.

## Web Push em produção

Leia o guia completo em `docs/web-push-deployment.md`.

Resumo:

1. Execute `supabase/schema.sql` ou a migration `supabase/migrations/20260708010000_live_push_alerts.sql`.
2. Configure VAPID, Supabase e `CRON_SECRET` na Vercel.
3. Agende `/api/push/monitor` com `Authorization: Bearer <CRON_SECRET>`.
4. Use frequência de 1 a 5 minutos para jogos ao vivo. No plano Hobby da Vercel, use um agendador externo porque cron frequente não é compatível.
5. Teste com `POST /api/push/test` protegido por `CRON_SECRET`.

## Formato do webhook ao vivo

Envie uma requisição `POST` para `/api/live/webhook` com o cabeçalho:

```text
Authorization: Bearer <LAP_LIVE_WEBHOOK_TOKEN>
Content-Type: application/json
```

Exemplo de corpo:

```json
{
  "eventId": "401999999",
  "sportId": "futebol",
  "state": "in",
  "status": "72'",
  "homeScore": 2,
  "awayScore": 1,
  "occurredAt": "2026-07-07T15:35:00.000Z"
}
```

Em uma implantação com múltiplas instâncias, substitua o broadcast em memória do webhook por Redis, Supabase Realtime, Ably, Pusher ou outro pub/sub compartilhado.

## Estrutura principal

- `app/copa-2026` — hub da Copa
- `app/agenda` — agenda e filtros
- `app/ao-vivo` — central operacional de placares
- `app/jogos/[sport]/[id]` — central de jogo
- `app/favoritos` — favoritos do dispositivo
- `app/admin` — redação
- `app/admin/monitoramento` — saúde das fontes
- `app/api/live/stream` — SSE
- `app/api/live/webhook` — entrada de eventos do provedor
- `app/api/push/*` — Web Push, preferências, monitor e teste protegido
- `app/api/games/[sport]/[id]` — dados de uma partida
- `app/api/health` — health check
- `app/feed.xml` — RSS
- `lib/live-data.ts` — adaptadores, catálogo de futebol mundial, NFL/F1, normalização, cache resiliente e dados de partida
- `lib/providers/*` — contrato comum e adaptadores ESPN, Google News, Supabase, CMS e mapa editorial
- `lib/sport-hubs/*` — configuração e composição de dados específica por modalidade
- `components/sport-hubs/*` — experiências de esportes de equipe, circuitos, corridas, lutas e provas
- `lib/resilient-game-details.ts` — resolução multiesporte de eventos atuais e antigos
- `lib/site-audit.ts` — auditoria de rotas, conteúdo útil, linguagem pública e amostras de eventos
- `lib/score-integrity.ts` — regra central de verdade para placares e conflitos
- `lib/push-alerts.ts` — matching de favoritos, eventos de alerta e deduplicação
- `lib/push-store.ts` — persistência Supabase de assinaturas, snapshots e entregas
- `components/coverage-hub.tsx` — central de futebol mundial e painéis prioritários de NFL/Fórmula 1
- `lib/editorial-store.ts` — persistência editorial server-side

## Dados e direitos

A LAP trabalha com metadados, placares e briefings. Para publicar textos ou imagens completos de terceiros, use apenas material próprio ou licenciado. O catálogo atual organiza as principais competições globais, mas cobertura literal de todas as ligas profissionais do mundo exige um provedor licenciado com catálogo global e contrato de uso. Antes de publicar em escala, substitua fontes comunitárias por provedores de dados licenciados e configure observabilidade da infraestrutura.

O contrato para adicionar ou trocar provedores está documentado em `docs/sports-provider-contract.md`.
