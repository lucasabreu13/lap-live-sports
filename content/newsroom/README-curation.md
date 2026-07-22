# Curadoria verificada da LAP

`curated-articles.json` é a camada editorial de matérias verificadas manualmente antes da publicação.

- Não substitui os agentes automáticos; complementa o arquivo gerado por eles.
- Cada item precisa ter fonte verificável, URL de referência e data de publicação.
- `scripts/newsroom-curated-merge.mjs` reincorpora estes itens a `articles.json` após a manutenção automática para evitar que a curadoria seja removida por um ciclo do Newsroom.
- `lib/newsroom-content.ts` também lê a curadoria diretamente, garantindo que previews e falhas temporárias do arquivo remoto continuem exibindo as matérias verificadas.
- Quando fontes confiáveis divergirem em um dado, a LAP deve omitir o número ou explicitar a incerteza em vez de escolher um valor sem confirmação.
