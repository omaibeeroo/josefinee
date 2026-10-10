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

root_body="$(mktemp)"
trap 'rm -f "$root_body"' EXIT
mode=""
root_status=""
for attempt in $(seq 1 30); do
  # Deployment-status events can arrive while the URL is still warming up.
  root_status="$(curl --silent --output "$root_body" --write-out '%{http_code}' "$BASE_URL/" 2>/dev/null || true)"
  if [[ "$root_status" == "200" ]]; then
    mode="storefront"
    break
  fi
  if [[ "$root_status" == "503" ]] && grep -Fq 'COMING SOON' "$root_body"; then
    mode="maintenance"
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "Production deployment did not become ready at $BASE_URL (last HTTP status: ${root_status:-000})." >&2
    exit 1
  fi
  sleep 2
done

if [[ "$mode" == "storefront" ]]; then
  expect_status 200 "existing product detail" "$BASE_URL/products/luna-pearl-necklace"
  expect_status 404 "missing product detail" "$BASE_URL/products/ci-missing-product-slug"
else
  # Maintenance intentionally returns 503 to prevent storefront pages being indexed
  # or treated as available; the branded marker distinguishes this from an outage.
  echo "Verified the intentional Coming Soon maintenance response (HTTP 503)."
  expect_status 503 "product route during maintenance" "$BASE_URL/products/luna-pearl-necklace"
fi

expect_status 401 "unauthorized retention request" --request POST "$BASE_URL/api/internal/retention"

headers="$(curl --silent --show-error --dump-header - --output /dev/null "$BASE_URL/")"
grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' <<<"$headers"
grep -Eiq '^x-frame-options:[[:space:]]*DENY' <<<"$headers"

if [[ -n "$RETENTION_JOB_SECRET" ]]; then
  expect_status 200 "authorized retention request" \
    --request POST \
    --header "Authorization: Bearer $RETENTION_JOB_SECRET" \
    "$BASE_URL/api/internal/retention"
else
  echo "RETENTION_JOB_SECRET is not configured; authorized internal-route check skipped."
fi

echo "Production deployment smoke checks passed for $BASE_URL ($mode mode)"
