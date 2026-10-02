#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RETENTION_JOB_SECRET="${RETENTION_JOB_SECRET:-}"

if [[ -z "$RETENTION_JOB_SECRET" ]]; then
  echo "RETENTION_JOB_SECRET is required" >&2
  exit 2
fi

http_status() {
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$@"
}

for attempt in $(seq 1 30); do
  if [[ "$(http_status "$BASE_URL/")" == "200" ]]; then
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "Storefront did not become ready at $BASE_URL" >&2
    exit 1
  fi
  sleep 1
done

test "$(http_status "$BASE_URL/products/luna-pearl-necklace")" = "200"
test "$(http_status "$BASE_URL/products/ci-missing-product-slug")" = "404"
test "$(http_status --request POST "$BASE_URL/api/internal/retention")" = "401"
test "$(http_status --request POST --header "Authorization: Bearer $RETENTION_JOB_SECRET" "$BASE_URL/api/internal/retention")" = "200"

echo "Production smoke checks passed for $BASE_URL"
