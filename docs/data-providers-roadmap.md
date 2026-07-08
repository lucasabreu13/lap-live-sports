# LAP — roadmap de fontes esportivas fortes

A LAP deve tratar cada modalidade com a superfície correta:

- esportes de confronto usam grade de jogos, placar, timeline, estatísticas e escalações;
- corridas usam calendário, sessões, grid, voltas e classificação;
- torneios usam chave, leaderboard, rodadas, baterias ou grupos;
- lutas usam card, rounds, método e estatísticas por round.

## Camada atual

- ESPN Site API: placares, agenda, summary e boxscore quando disponível.
- Google News RSS: cobertura editorial e contexto.
- Supabase: favoritos, push, snapshots e entregas.
- Cache saudável da LAP: preserva último retorno válido quando a fonte falha.

## Próxima camada com chaves de API

Variáveis previstas para provedores pagos ou freemium:

- `API_SPORTS_KEY`
- `SPORTSDATAIO_KEY`
- `SPORTRADAR_KEY`
- `THESPORTSDB_KEY`

Essas chaves devem ficar apenas no servidor/Vercel. Nunca usar `NEXT_PUBLIC_` para chaves privadas.

## Estratégia de prioridade

1. Usar fonte especializada quando houver chave configurada.
2. Normalizar tudo para o modelo interno da LAP.
3. Aplicar integridade antes de exibir placar ou evento sensível.
4. Usar ESPN e Google News como fallback.
5. Se a modalidade não tiver grade, exibir a superfície correta: calendário, leaderboard, card, bateria, heat, grid ou classificação.

## Força por provedor

- API-SPORTS: bom caminho custo/benefício para futebol, basquete, baseball, Formula 1, NFL/NCAA, rugby, vôlei e MMA.
- SportsDataIO: forte para NFL, NBA, MLB, golf, soccer, tennis, F1 e MMA.
- Sportradar: opção enterprise mais completa para dezenas de esportes, com API específica e geral por esporte.
- TheSportsDB: bom complemento para eventos, arte, highlights e TV/listings, não deve ser a única fonte de placar crítico.
