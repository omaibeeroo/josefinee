/**
 * Receives Content-Security-Policy violation reports (report-uri).
 * Logs and discards — used to tune the CSP without breaking the store.
 */
export async function POST(request: Request) {
  try {
    const report = await request.json().catch(() => null);
    if (process.env.NODE_ENV === "development") {
      console.warn("[csp] violation report", JSON.stringify(report)?.slice(0, 1000));
    }
  } catch {
    // never fail on telemetry
  }
  return new Response(null, { status: 204 });
}
