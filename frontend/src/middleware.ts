import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const adminAuth = request.cookies.get('admin_auth');
  const memberAuth = request.cookies.get('member_auth');

  // 이미 로그인 상태에서 로그인 페이지 접근 → 대시보드로 리다이렉트
  if (pathname === '/admin/login' && adminAuth) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  if (pathname === '/login' && memberAuth) {
    return NextResponse.redirect(new URL('/member/dashboard', request.url));
  }

  // 관리자 라우트 보호 (/admin/login 제외)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!adminAuth) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // 회원 라우트 보호
  if (pathname.startsWith('/member')) {
    if (!memberAuth) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/member/:path*'],
};
