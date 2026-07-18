# Contrato de provedores esportivos

A camada em `lib/providers/` separa disponibilidade de dados da apresentação. Todo adaptador retorna:

```ts
type ProviderResult<T> = {
  status: "live" | "stale" | "unavailable";
  data: T;
  generatedAt: string;
  error?: string;
  publicMessage?: string;
};
```

`error` serve apenas para logs e auditoria. A interface usa `publicMessage` ou estados editoriais definidos pelo produto; detalhes de requisição, credenciais e respostas brutas nunca devem chegar ao navegador.

## Adaptadores atuais

- `espn-provider.ts`: agenda, detalhes, classificações, sessões de F1 e leaderboard do PGA.
- `google-news-provider.ts`: briefings por modalidade com link interno para a LAP.
- `supabase-cache-provider.ts`: última carga esportiva persistida e recuperação de eventos.
- `editorial-provider.ts`: matérias publicadas pelo CMS.
- `static-sport-provider.ts`: mapa editorial estável de cada modalidade, sem placares ou rankings.

## Adicionar uma API licenciada

1. Crie um adaptador em `lib/providers/` que converta a resposta externa para os tipos internos.
2. Inicialize SDKs e credenciais dentro de funções, nunca no escopo do módulo.
3. Mantenha chaves somente em variáveis server-side, sem prefixo `NEXT_PUBLIC_`.
4. Preserve os IDs externos e o caminho do provedor para permitir resolução histórica.
5. Retorne `unavailable` em falhas; não complete score, posição, atleta ou prêmio manualmente.
6. Ligue o adaptador em `lib/sport-hubs/load-sport-hub.ts` ou no resolvedor de jogos.
7. Adicione testes de parsing com respostas anonimizadas e execute `typecheck`, `test:data` e `build`.

## Regras de verdade

- Placares passam por `lib/score-integrity.ts` antes da renderização ou de alertas.
- Torneios, etapas e provas sem placar de confronto usam tipos de evento próprios.
- Classificações e leaderboards só aparecem quando o adaptador devolve linhas estruturadas.
- Listas editoriais de competições nunca são apresentadas como ranking.
- Artigos externos são resumidos e creditados; o conteúdo integral não é reproduzido.
