import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Add security headers to all responses
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Public paths that do not require authentication
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/api/v1/health") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  let session = null;
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      session = await verifySessionToken(sessionCookie);
    }
  } catch {
    session = null;
  }

  // If already authenticated and trying to access /login, redirect to /dashboard
  // UNLESS explicitly resetting or logging out (prevents infinite error recovery loops)
  const isReset =
    request.nextUrl.searchParams.has("reset") ||
    request.nextUrl.searchParams.has("logout");

  if (session && pathname.startsWith("/login") && !isReset) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If not authenticated and trying to access protected CRM routes, redirect to /login
  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated, forward user identity headers for downstream server components
  if (session) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", String(session.id || ""));
    requestHeaders.set("x-org-id", String(session.organizationId || ""));
    requestHeaders.set("x-user-role", String(session.role || "User"));

    const authResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    authResponse.headers.set("X-Frame-Options", "DENY");
    authResponse.headers.set("X-Content-Type-Options", "nosniff");
    authResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return authResponse;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
