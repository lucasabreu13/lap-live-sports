# Web Push e alertas persistentes da LAP

Este guia ativa alertas que chegam mesmo com o site fechado, usando Push API, Service Worker, backend Next.js, Supabase e VAPID.

## Variáveis obrigatórias

Configure no `.env.local` e na Vercel:

```bash
NEXT_PUBLIC_SITE_URL=https://seu-dominio.com
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=cole-a-service-role-key-aqui
NEXT_PUBLIC_VAPID_PUBLIC_KEY=cole-a-chave-publica-vapid
VAPID_PRIVATE_KEY=cole-a-chave-privada-vapid
VAPID_SUBJECT=mailto:contato@seu-dominio.com
CRON_SECRET=token-longo-para-cron
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` ou `CRON_SECRET` com prefixo `NEXT_PUBLIC_`.

## Gerar VAPID

```bash
npx web-push generate-vapid-keys
```

Copie a chave pública para `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e a privada para `VAPID_PRIVATE_KEY`.

## Supabase

Para projeto novo, execute `supabase/schema.sql` no SQL Editor.

Para projeto existente, execute a migration:

```text
supabase/migrations/20260708010000_live_push_alerts.sql
```

Ela cria:

- `lap_push_subscriptions`: inscrição Push por `device_id`;
- `lap_live_event_snapshots`: último estado válido por evento;
- `lap_push_deliveries`: deduplicação por assinatura, evento, tipo e hash.

As tabelas ficam com RLS habilitado e grants apenas para `service_role`.

## Endpoints

- `POST /api/push/subscribe`: salva assinatura Push do dispositivo.
- `PUT /api/push/preferences`: sincroniza favoritos e preferências.
- `DELETE /api/push/unsubscribe`: desativa a assinatura.
- `GET|POST /api/push/monitor`: executa o monitor, protegido por `Authorization: Bearer <CRON_SECRET>`.
- `POST /api/push/test`: envia teste para um `deviceId`, protegido pelo mesmo `CRON_SECRET`.

Teste manual protegido:

```bash
curl -X POST "https://seu-dominio.com/api/push/test" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"COLE-O-DEVICE-ID"}'
```

## Agendamento

O monitor precisa rodar com frequência suficiente para jogos ao vivo. A LAP não deve prometer alerta instantâneo se o scheduler roda uma vez por dia.

Na Vercel Pro, use um cron de 1 a 5 minutos, por exemplo:

```json
{
  "crons": [
    { "path": "/api/push/monitor", "schedule": "*/5 * * * *" }
  ]
}
```

No plano Hobby, a Vercel limita cron a frequência diária. Nesse caso, use um agendador externo, como GitHub Actions, cron-job.org, Upstash QStash, Render Cron Job ou Supabase Edge Scheduler, chamando:

```bash
curl -X POST "https://seu-dominio.com/api/push/monitor" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Checklist manual

1. Execute a migration ou o schema atualizado no Supabase.
2. Configure as variáveis no `.env.local`.
3. Rode `npm run dev`.
4. Abra a LAP, favorite um jogo/time/liga/modalidade.
5. Clique no sino e aceite a permissão do navegador.
6. Verifique no Supabase se `lap_push_subscriptions` recebeu o dispositivo.
7. Feche o navegador ou deixe a PWA em segundo plano.
8. Rode `/api/push/test` com `CRON_SECRET`.
9. Toque na notificação e confirme que ela abre `/favoritos` ou a URL enviada.
10. Remova um favorito e confirme sincronização em `favorite_ids`.
11. Desative o sino e confirme `enabled = false`.
12. Para inscrição expirada, o monitor desativa a assinatura quando o provedor retorna 404 ou 410.

## Limitações reais

- O monitor usa somente eventos com `integrity === "verified"`.
- A fonte ESPN pode não retornar estádio, transmissão, minuto, timeline, escalação ou estatísticas para todos os esportes.
- Alertas de escalação dependem de `summary` do jogo e são buscados apenas para jogos favoritados diretamente, para evitar chamadas detalhadas em massa.
- Alertas de gol identificam o time somente quando a mudança de placar permite inferir isso com segurança; caso contrário, usam “Placar atualizado”.
- A entrega depende do navegador, sistema operacional, permissão do usuário e validade da inscrição Push.
