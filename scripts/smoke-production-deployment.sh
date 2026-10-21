#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
EXPECTED_DEPLOYMENT_SHA="${EXPECTED_DEPLOYMENT_SHA:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "BASE_URL is required" >&2
  exit 2
fi
if [[ ! "$EXPECTED_DEPLOYMENT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "EXPECTED_DEPLOYMENT_SHA must be the 40-character deployment commit SHA" >&2
  exit 2
fi
checked_out_sha="$(git rev-parse HEAD 2>/dev/null || true)"
if [[ "$checked_out_sha" != "$EXPECTED_DEPLOYMENT_SHA" ]]; then
  echo "Smoke scripts are not running from the deployed SHA (expected $EXPECTED_DEPLOYMENT_SHA, got ${checked_out_sha:-unknown})." >&2
  exit 1
fi
BASE_URL="${BASE_URL%/}"

# deployment_status.target_url is event data. Never let a workflow event turn
# this read-only smoke job into a request to an arbitrary host or internal IP.
if ! node - "$BASE_URL" <<'NODE'
const raw = process.argv[2];
try {
  const url = new URL(raw);
  const allowedHost =
    url.hostname === "hanadistore.vercel.app" ||
    /^josefinee-store-[a-z0-9-]+-prettyjosefinee-4817\.vercel\.app$/.test(url.hostname);
  if (
    url.protocol !== "https:" ||
    !allowedHost ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search ||
    url.hash
  ) {
    throw new Error("target is outside the approved Hanadi Vercel hosts");
  }
} catch {
  console.error("Refusing production smoke: BASE_URL must use an approved Hanadi HTTPS Vercel host.");
  process.exit(1);
}
NODE
then
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

root_body="$(mktemp)"
root_headers="$(mktemp)"
trap 'rm -f "$root_body" "$root_headers"' EXIT
mode=""
root_status=""
for attempt in $(seq 1 30); do
  # Deployment-status events can arrive while the URL is still warming up.
  root_status="$(curl --silent --dump-header "$root_headers" --output "$root_body" --write-out '%{http_code}' "$BASE_URL/" 2>/dev/null || true)"
  if [[ "$root_status" == "200" ]]; then
    mode="storefront"
    break
  fi
  # Maintenance is detected by the stable response header set in
  # src/middleware.ts; the localized 503 body is never the contract. The
  # legacy text check only covers deployments older than the header.
  if [[ "$root_status" == "503" ]] && {
    grep -Eiq '^x-hanadi-maintenance:[[:space:]]*coming-soon' "$root_headers" ||
      grep -Fq 'COMING SOON' "$root_body"
  }; then
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

expect_status 200 "admin login page" "$BASE_URL/admin/login"
expect_status 307 "unauthenticated admin redirect" "$BASE_URL/admin"
admin_redirect_headers="$(curl --silent --show-error --dump-header - --output /dev/null "$BASE_URL/admin")"
grep -Eiq '^location:[[:space:]]*/admin/login([[:space:]]|$)' <<<"$admin_redirect_headers"

expect_status 401 "unauthorized retention request" --request POST "$BASE_URL/api/internal/retention"

headers="$(curl --silent --show-error --dump-header - --output /dev/null "$BASE_URL/")"
grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' <<<"$headers"
grep -Eiq '^x-frame-options:[[:space:]]*DENY' <<<"$headers"

echo "Production deployment smoke checks passed for $BASE_URL ($mode mode)"
