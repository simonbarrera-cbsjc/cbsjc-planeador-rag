import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

const PROTECTED_PREFIXES = ['/dashboard', '/upload', '/generate', '/preview', '/history']
const AUTH_ROUTES = ['/login']

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
  "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join('; ')

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Content-Security-Policy': CSP_HEADER,
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(header, value)
  }
  return res
}

export async function middleware(request: NextRequest) {
  // Handle CORS preflight / OPTIONS requests (for Vercel toolbar & API preflights)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  let supabaseResponse = NextResponse.next({ request })

  // FAST PATH: If the route is neither protected nor auth-related (public pages, assets),
  // return immediately without querying database/auth.
  if (!isProtected && !isAuthRoute) {
    return applySecurityHeaders(supabaseResponse)
  }

  const allCookies = request.cookies.getAll()
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith('sb-') && c.name.includes('auth-token')
  )

  // FAST PATH: Unauthenticated user accessing a protected route -> redirect to login immediately
  if (isProtected && !hasAuthCookie) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return applySecurityHeaders(NextResponse.redirect(loginUrl))
  }

  // FAST PATH: User accessing /login without existing session cookies -> allow immediately
  if (isAuthRoute && !hasAuthCookie) {
    return applySecurityHeaders(supabaseResponse)
  }

  // At this point, the user has auth cookies and is on a protected route or /login.
  // Validate with strict timeout guards to prevent 504 MIDDLEWARE_INVOCATION_TIMEOUT
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          fetch: (url: RequestInfo | URL, options?: RequestInit) => {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 1800)
            const init = options || {}
            if (init.signal) {
              init.signal.addEventListener('abort', () => controller.abort())
            }
            return fetch(url, { ...init, signal: controller.signal }).finally(() =>
              clearTimeout(timer)
            )
          },
        },
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    let user = null
    try {
      const userPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Auth verification timeout')), 2000)
      )
      const res = await Promise.race([userPromise, timeoutPromise])
      user = res.data?.user || null
    } catch {
      user = null
    }

    // Redirect unauthenticated users to login
    if (isProtected && !user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('next', pathname)
      return applySecurityHeaders(NextResponse.redirect(loginUrl))
    }

    // Redirect authenticated users away from login
    if (isAuthRoute && user) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      dashboardUrl.searchParams.delete('next')
      return applySecurityHeaders(NextResponse.redirect(dashboardUrl))
    }

    // If on /login with invalid/stale/unreachable cookies, clean them up so subsequent requests are fast
    if (isAuthRoute && !user && hasAuthCookie) {
      for (const c of allCookies) {
        if (c.name.startsWith('sb-') && c.name.includes('auth-token')) {
          supabaseResponse.cookies.delete(c.name)
        }
      }
    }
  } catch (err) {
    console.error('Middleware auth check error:', err)
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo.png|banner.png|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|css|js)$).*)',
  ],
}
