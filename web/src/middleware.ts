import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Verificamos si existe la cookie de autenticación de Supabase
  // El nombre de la cookie suele ser 'sb-[project-ref]-auth-token'
  const authCookie = request.cookies.get('sb-orrxhxowxrvcvvgzvevp-auth-token')
  
  const { pathname } = request.nextUrl

  // Si no hay cookie y no estamos en login, redirigir a login
  if (!authCookie && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si hay cookie y estamos en login, redirigir a la home
  if (authCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// Configurar qué rutas debe proteger el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
