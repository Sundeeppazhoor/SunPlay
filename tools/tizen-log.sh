#!/bin/bash
# Grava o log da TV Samsung num arquivo, sem foto e sem servidor.
#
# POR QUE ESTE SCRIPT EXISTE: o port inteiro foi investigado por FOTO DA TELA.
# O painel guarda 34 linhas, o comeco rola, e cada pergunta nova custava outra
# viagem ate o aparelho. O log completo sempre esteve no console do Chromium da
# TV, que o `sdb dlog` carrega — o que faltava era o comando pronto.
#
#   bash tools/tizen-log.sh 192.168.1.50
#   bash tools/tizen-log.sh 192.168.1.50 tudo     # sem filtro
#
# Deixe rodando enquanto usa a TV. Ctrl+C encerra e o arquivo fica.
set -u
IP="${1:-}"
MODO="${2:-nuvio}"
SAIDA="nuvio-tv-$(date +%Y%m%d-%H%M%S).log"

if [ -z "$IP" ]; then
  echo "uso: bash tools/tizen-log.sh <ip-da-tv> [tudo]" >&2
  echo "     o IP aparece em Rede > Estado da rede, na propria TV" >&2
  exit 1
fi
command -v sdb >/dev/null 2>&1 || {
  echo "sdb nao encontrado. Ele vem com o Tizen Studio; costuma ficar em" >&2
  echo "  ~/tizen-studio/tools/sdb" >&2
  exit 1
}

sdb connect "$IP" >/dev/null 2>&1
sdb devices | grep -q device || { echo "nao conectou em $IP" >&2; exit 1; }
echo "conectado. Gravando em $SAIDA — use a TV normalmente, Ctrl+C para parar."

# ConsoleMessage e a tag do Chromium da TV; os nossos prefixos entram por ela.
# O modo "tudo" serve quando o app morre ANTES de imprimir qualquer coisa, que e
# quando a pista esta no log do sistema e nao no nosso.
if [ "$MODO" = "tudo" ]; then
  sdb dlog 2>&1 | tee "$SAIDA"
else
  sdb dlog 2>&1 | grep --line-buffered -E \
    "NV-DIAG|NV-ERRO|\[arranque\]|\[mem\]|\[fios\]|\[tex\]|\[video\]|\[dados\]|\[t\]|\[desc\]|FPS=|Aborted|RuntimeError|OOM" \
    | tee "$SAIDA"
fi
