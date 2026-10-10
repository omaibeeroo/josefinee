#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
RETENTION_JOB_SECRET="${RETENTION_JOB_SECRET:-}"
TRUSTED_CLIENT_IP_HEADER="${TRUSTED_CLIENT_IP_HEADER:-x-real-ip}"

if [[ -z "$RETENTION_JOB_SECRET" ]]; then
  echo "RETENTION_JOB_SECRET is required" >&2
  exit 2
fi

http_status() {
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$@"
}

expect_status() {
  local expected="$1"
  local label="$2"
  shift 2

  local actual
  if ! actual="$(http_status "$@" 2>/dev/null)"; then
    actual="000"
  fi
  if [[ "$actual" != "$expected" ]]; then
    printf 'Expected HTTP %s for %s; received HTTP %s.\n' "$expected" "$label" "$actual" >&2
    exit 1
  fi
}

ready=false
for attempt in $(seq 1 30); do
  # A connection refusal during startup is expected; keep the readiness probe quiet.
  status="$(http_status "$BASE_URL/" 2>/dev/null || true)"
  if [[ "$status" == "200" ]]; then
    ready=true
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "Storefront did not become ready at $BASE_URL (last HTTP status: ${status:-000})." >&2
    exit 1
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  echo "Storefront did not become ready at $BASE_URL." >&2
  exit 1
fi

expect_status 200 "existing product detail" "$BASE_URL/products/luna-pearl-necklace"
expect_status 404 "missing product detail" "$BASE_URL/products/ci-missing-product-slug"
expect_status 401 "unauthorized retention request" --request POST "$BASE_URL/api/internal/retention"

# The local CI server has no trusted edge proxy to inject this header. Supply a
# loopback address only for loopback smoke runs; never spoof it for a public URL.
local_ip_header=()
if [[ "$BASE_URL" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?$ ]]; then
  local_ip_header=(--header "$TRUSTED_CLIENT_IP_HEADER: 127.0.0.1")
fi
expect_status 200 "authorized retention request" \
  --request POST \
  --header "Authorization: Bearer $RETENTION_JOB_SECRET" \
  "${local_ip_header[@]}" \
  "$BASE_URL/api/internal/retention"

echo "Production smoke checks passed for $BASE_URL"
