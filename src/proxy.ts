import { NextResponse, type NextRequest } from 'next/server';

/*
 * docs/02 §11: a nonce-based Content-Security-Policy on every response, and a fast
 * redirect to /sign-in when there is no session cookie at all. This is NOT the security
 * boundary: every page, Server Action and Route Handler checks the session itself.
 */

// Either name of the session cookie (auth/cookies.ts): secure on https, plain on localhost.
const sessionCookies = ['__Host-session', 'worklog_session'];
const publicPaths = ['/sign-in', '/auth/github', '/auth/github/callback'];

export function contentSecurityPolicy(nonce: string, { isDevelopment, isHttps }: { readonly isDevelopment: boolean; readonly isHttps: boolean }): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets Next.js's nonce'd bootstrap load its own chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src 'self'${isDevelopment ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only on https: on http://localhost, Safari would upgrade the app's own assets and break.
    ...(isHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isPublic = publicPaths.includes(pathname) || pathname.startsWith('/preview');
  if (!isPublic && !sessionCookies.some((name) => request.cookies.has(name))) {
    const signIn = new URL('/sign-in', request.url);
    // Only the path is carried over; /auth/github validates it again (open-redirect safe).
    signIn.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, {
    isDevelopment: process.env.NODE_ENV === 'development',
    isHttps: process.env['APP_URL']?.startsWith('https://') ?? true,
  });
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  // Next.js reads the policy from the request to put the nonce on its own scripts.
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
