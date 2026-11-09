import { NextResponse, type NextRequest } from 'next/server'
export function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const embed = request.nextUrl.pathname === '/embed'
  const allowed = (process.env.EMBED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => {
      try {
        return new URL(v).origin === v && v.startsWith('https://')
      } catch {
        return false
      }
    })
  response.headers.set(
    'Content-Security-Policy',
    'frame-ancestors ' +
      (embed ? ["'self'", ...allowed].join(' ') : "'none'") +
      "; object-src 'none'; base-uri 'self'",
  )
  if (!embed) response.headers.set('X-Frame-Options', 'DENY')
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
