# Melhorias implementadas — LAP Live Sports

## Entregas deste ciclo

1. **Feed resiliente:** cache de última resposta válida por até 20 minutos para evitar que a home zere quando uma fonte externa oscilar.
2. **Estado de fontes:** cada modalidade informa se está ao vivo, usando cache resiliente ou em reconexão.
3. **Conteúdo inicial próprio:** guias LAP de futebol mundial, F1, NFL e favoritos impedem áreas editoriais vazias sem inventar resultados.
4. **Futebol mundial:** catálogo configurável com 25 competições, incluindo Brasileirão A/B, Copa do Brasil, Libertadores, Sul-Americana, Champions, grandes ligas europeias e competições americanas/sul-americanas.
5. **Central global de futebol:** filtro por competição, cards para seguir ligas e visualização de agenda disponível.
6. **NFL:** nova modalidade com rota própria, navegação, busca, agenda e integração de placares por fonte.
7. **Fórmula 1:** nova agenda com leitura específica de eventos de corrida, prazo amplo de busca e central própria.
8. **Agenda evoluída:** filtros de hoje, amanhã, semana, modalidade, liga, status e busca textual.
9. **Google Calendar:** eventos futuros podem ser adicionados ao calendário diretamente pelo botão `＋` no card.
10. **Busca e favoritos ampliados:** busca por ligas e possibilidade de salvar ligas junto de modalidades e jogos.
11. **Monitoramento técnico:** painel mostra feeds ativos, caches resilientes e quantidade de ligas mapeadas.

## Cobertura literal de todas as ligas

O catálogo atual é pronto para expansão e cobre as principais competições. Para disponibilizar **todas** as ligas profissionais do mundo com regularidade e direitos de uso, conecte um provedor licenciado de dados globais (por exemplo, API-Football, Sportradar ou Stats Perform), pois a disponibilidade do feed público varia por país e competição.

## Publicação

1. Execute `supabase/schema.sql` novamente no SQL Editor para permitir matérias de NFL.
2. Suba estes arquivos para o repositório/projeto Vercel já existente.
3. Faça o deploy de produção. As variáveis configuradas anteriormente continuam válidas; nenhuma chave está incluída neste pacote.
