#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
RETENTION_JOB_SECRET="${RETENTION_JOB_SECRET:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "BASE_URL is required" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

http_status() {
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$@"
}

for attempt in $(seq 1 30); do
  if [[ "$(http_status "$BASE_URL/")" == "200" ]]; then
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "Production deployment did not become ready at $BASE_URL" >&2
    exit 1
  fi
  sleep 2
done

test "$(http_status "$BASE_URL/products/luna-pearl-necklace")" = "200"
test "$(http_status "$BASE_URL/products/ci-missing-product-slug")" = "404"
test "$(http_status --request POST "$BASE_URL/api/internal/retention")" = "401"

headers="$(curl --silent --show-error --dump-header - --output /dev/null "$BASE_URL/")"
grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' <<<"$headers"
grep -Eiq '^x-frame-options:[[:space:]]*DENY' <<<"$headers"

if [[ -n "$RETENTION_JOB_SECRET" ]]; then
  test "$(http_status --request POST --header "Authorization: Bearer $RETENTION_JOB_SECRET" "$BASE_URL/api/internal/retention")" = "200"
else
  echo "RETENTION_JOB_SECRET is not configured; authorized internal-route check skipped."
fi

echo "Production deployment smoke checks passed for $BASE_URL"
