'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth.store';

export default function MemberHistoryPage() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/login');
  }, [_hasHydrated, isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="card max-w-md w-full text-center space-y-4">
        <div className="text-4xl">📋</div>
        <h1 className="text-2xl font-bold text-gray-900">포인트 이용내역</h1>
        <p className="text-gray-500 text-sm">
          포인트 이용내역 페이지는 현재 준비 중입니다.<br />
          전체 내역은 대시보드에서 최근 10건을 확인할 수 있습니다.
        </p>
        <button
          onClick={() => router.push('/member/dashboard')}
          className="btn-primary w-full"
        >
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
