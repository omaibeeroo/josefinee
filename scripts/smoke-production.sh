#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
RETENTION_JOB_SECRET="${RETENTION_JOB_SECRET:-}"

# This script intentionally exercises the destructive authorized retention
# endpoint, so it may only target the disposable local/CI database server.
if [[ "${CI:-}" != "true" ]]; then
  echo "Refusing authorized retention smoke outside CI." >&2
  exit 2
fi

if ! node - "$BASE_URL" <<'NODE'
const raw = process.argv[2];
try {
  const url = new URL(raw);
  const loopback = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (
    url.protocol !== "http:" ||
    !loopback.has(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("not a plain HTTP loopback URL");
  }
} catch {
  console.error("Refusing authorized retention smoke: BASE_URL must be an HTTP loopback URL.");
  process.exit(1);
}
NODE
then
  exit 2
fi

if [[ -z "$RETENTION_JOB_SECRET" ]]; then
  echo "RETENTION_JOB_SECRET must be a test-only secret for the isolated local smoke target." >&2
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
expect_status 200 "admin login page" "$BASE_URL/admin/login"
expect_status 307 "unauthenticated admin redirect" "$BASE_URL/admin"
admin_redirect_headers="$(curl --silent --show-error --dump-header - --output /dev/null "$BASE_URL/admin")"
grep -Eiq '^location:[[:space:]]*/admin/login([[:space:]]|$)' <<<"$admin_redirect_headers"
expect_status 401 "unauthorized retention request" --request POST "$BASE_URL/api/internal/retention"
expect_status 200 "authorized disposable-database retention request" \
  --request POST \
  --header "Authorization: Bearer $RETENTION_JOB_SECRET" \
  --header "x-real-ip: 127.0.0.1" \
  "$BASE_URL/api/internal/retention"

echo "Isolated standalone smoke checks passed for $BASE_URL"
