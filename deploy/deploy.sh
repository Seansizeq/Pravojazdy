#!/usr/bin/env bash
# Збирає гру й викладає на VPS. Запуск: npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

# читаємо .env.deploy без source, бо Windows-шлях містить зворотні слеші
val() { grep -E "^$1=" .env.deploy | head -1 | cut -d= -f2- | tr -d '\r'; }
HOST=$(val DEPLOY_HOST)
USER_=$(val DEPLOY_USER)
DIR=$(val DEPLOY_APP_DIR)
URL=$(val SITE_URL)
KEY=$(val DEPLOY_PRIVATE_KEY_PATH)
KEY=$(cygpath -u "$KEY" 2>/dev/null || echo "$KEY")
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=15 "$USER_@$HOST")

echo "▶ Збірка"
npm run build

echo "▶ Завантаження в $DIR"
# спершу в тимчасову папку, потім миттєва заміна, щоб сайт не був «напівзалитим»
tar -C dist -czf - . | "${SSH[@]}" "set -e
  rm -rf '$DIR.new' && mkdir -p '$DIR.new' && tar -xzf - -C '$DIR.new'
  chmod -R a+rX '$DIR.new'
  rm -rf '$DIR.old'
  [ -d '$DIR' ] && mv '$DIR' '$DIR.old'
  mv '$DIR.new' '$DIR'"

echo "▶ Перевірка"
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/")
echo "$URL → HTTP $code"
[ "$code" = 200 ]
