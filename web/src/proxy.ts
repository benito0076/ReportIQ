import { NextResponse, type NextRequest } from "next/server";

/**
 * Control optimista: redirige a /login si no hay cookie de sesión. La
 * verificación real (firma y usuario existente) se hace en el servidor en
 * cada página, acción y Route Handler.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));
  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/proyectos/:path*", "/equipos/:path*", "/usuarios/:path*", "/ajustes/:path*", "/actividad/:path*", "/inicio/:path*", "/aire/:path*"],
};
