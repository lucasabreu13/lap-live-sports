# Radar LAP — descoberta e triagem de notícias

## Objetivo

O Radar LAP é a camada de descoberta de pautas do portal. Ele não publica conteúdo automaticamente. Sua função é encontrar notícias recentes, identificar a modalidade, reduzir duplicatas, atribuir uma nota de relevância e entregar referências para a Redação LAP.

## Cobertura

O Radar segue as editorias atuais do produto:

- Futebol
- NFL
- College Football
- Fórmula 1
- NBA
- Tênis
- Ciclismo / Tour de France
- MLB
- Golfe
- Surfe / WSL

Esportes fora da cobertura atual não entram na fila editorial.

## Fontes

### Ativa por padrão

- Google News RSS: descoberta ampla de notícias esportivas de veículos brasileiros e internacionais, incluindo resultados do ge quando indexados.

### Conectores opcionais

- `NEWSAPI_KEY`: NewsAPI
- `GNEWS_API_KEY`: GNews
- `GUARDIAN_API_KEY`: Guardian Open Platform

A ausência dessas chaves não impede o Radar de funcionar.

## Regras de triagem

Cada item recebe score de 0 a 100 considerando:

1. confiabilidade da fonte;
2. recência;
3. aderência às modalidades da LAP;
4. aderência à pesquisa digitada;
5. sinais de confirmação;
6. penalidade para rumor, sondagem ou negociação ainda não confirmada;
7. reforço quando a mesma história aparece em fontes diferentes.

Estados:

- **Candidata**: pauta forte para apuração/redação;
- **Acompanhar**: relevante, mas precisa de contexto ou confirmação;
- **Revisar**: baixa confiança/relevância comparativa.

## Segurança editorial

- O Radar não inventa notícia para preencher espaço.
- Falha de uma fonte gera retorno vazio dessa fonte, não conteúdo fabricado.
- Rumores são identificados como rumor/mercado.
- O link `Levar para a redação` abre o Núcleo Editorial com título, modalidade e referência da fonte pré-preenchidos.
- O corpo da matéria permanece vazio: a Redação precisa confirmar os fatos e produzir texto original.
- A política de retenção de 72 horas continua sendo aplicada somente depois que uma matéria é efetivamente publicada pela LAP.

## Atualização

- consultas normais usam cache de 5 minutos;
- o botão `Atualizar fontes agora` força nova consulta;
- a janela padrão de descoberta é de 72 horas.
