#!/usr/bin/env bash
set -eu

# A Newsroom AI publica o conteúdo em content/newsroom e o site lê esse arquivo
# dinamicamente do GitHub. Quando o commit contém somente conteúdo editorial
# automatizado, não há código novo para a Vercel compilar.
changed_files="$(git diff --name-only HEAD^ HEAD 2>/dev/null || true)"

if [ -z "$changed_files" ]; then
  echo "Build necessário: não foi possível determinar arquivos alterados."
  exit 1
fi

non_newsroom_changes="$(printf '%s\n' "$changed_files" | grep -v '^content/newsroom/' || true)"

if [ -z "$non_newsroom_changes" ]; then
  echo "Build ignorado: apenas conteúdo dinâmico da Newsroom AI foi alterado."
  exit 0
fi

echo "Build necessário: há alterações de código ou configuração."
exit 1
