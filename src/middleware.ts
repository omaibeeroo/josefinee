import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const development = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: *.facebook.com *.fbcdn.net *.tiktokcdn.com",
    "media-src 'self' https:",
    "connect-src 'self' ws: https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://graph.facebook.com https://connect.facebook.net https://analytics.tiktok.com https://*.tiktok.com",
    "frame-src https://www.facebook.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "report-uri /api/security/csp-report",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  if (request.nextUrl.pathname.startsWith("/products/")) {
    let slug: string;
    try {
      slug = decodeURIComponent(request.nextUrl.pathname.slice("/products/".length));
    } catch {
      slug = "";
    }
    if (!slug || slug.includes("/")) {
      return productNotFound(csp);
    }
    try {
      const [{ prisma }, { storefrontProductWhere }] = await Promise.all([
        import("@/lib/prisma"),
        import("@/server/catalog"),
      ]);
      const product = await prisma.product.findFirst({
        where: { ...storefrontProductWhere(), slug },
        select: { id: true },
      });
      if (!product) return productNotFound(csp);
    } catch {
      return new NextResponse("Service temporairement indisponible.", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": csp,
          "Retry-After": "30",
        },
      });
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/order/") || pathname.startsWith("/newsletter/unsubscribe/")) {
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

function productNotFound(csp: string): NextResponse {
  return new NextResponse(
    "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>Produit introuvable | NÛR Store</title></head><body><main><h1>Produit introuvable</h1><p>Ce produit n’existe plus ou n’est pas disponible.</p><a href=\"/shop\">Retour à la boutique</a></main></body></html>",
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": csp,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};
