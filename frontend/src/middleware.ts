import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 관리자 라우트 보호 (/admin/login 제외)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminAuth = request.cookies.get('admin_auth');
    if (!adminAuth) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // 회원 라우트 보호 (/login, /register 제외)
  if (pathname.startsWith('/member')) {
    const memberAuth = request.cookies.get('member_auth');
    if (!memberAuth) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/member/:path*'],
};
