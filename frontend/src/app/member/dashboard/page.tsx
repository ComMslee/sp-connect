'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../store/auth.store';
import { pointsApi } from '../../../utils/api';
import { PointTransaction } from '../../../types';
import dayjs from 'dayjs';

const TYPE_LABEL: Record<string, string> = {
  EARN: '+ 적립', USE: '- 사용', EXPIRE: '만료', CANCEL: '취소', ADJUST: '조정',
};
const TYPE_COLOR: Record<string, string> = {
  EARN: 'text-green-600', USE: 'text-red-500', EXPIRE: 'text-gray-400',
  CANCEL: 'text-yellow-600', ADJUST: 'text-blue-500',
};

export default function MemberDashboardPage() {
  const { user, isAuthenticated, _hasHydrated, clearAuth } = useAuthStore();
  const router = useRouter();

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: () => pointsApi.getBalance(),
    enabled: _hasHydrated && isAuthenticated,
  });

  const { data: historyData } = useQuery({
    queryKey: ['history'],
    queryFn: () => pointsApi.getHistory({ page: 1, limit: 10 }),
    enabled: _hasHydrated && isAuthenticated,
  });

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/login');
  }, [_hasHydrated, isAuthenticated, router]);

  // hydration 완료 전 또는 미인증 상태: 빈 화면 (콘텐츠 노출 방지)
  if (!_hasHydrated || !isAuthenticated) return null;

  const balance = (balanceData as any)?.data?.balance ?? user?.pointBalance ?? 0;
  const history: PointTransaction[] = (historyData as any)?.data?.items ?? [];

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 상단 헤더 */}
      <div className="bg-primary text-white px-4 pt-12 pb-8 rounded-b-3xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-blue-100 text-sm">{user?.name}님 안녕하세요</p>
            <p className="text-xs text-blue-200">{user?.phone}</p>
          </div>
          <button onClick={handleLogout} className="text-blue-100 text-sm">로그아웃</button>
        </div>

        {/* 잔액 */}
        <div className="text-center">
          <p className="text-blue-100 text-sm mb-1">보유 포인트</p>
          <p className="text-4xl font-bold">{balance.toLocaleString()}<span className="text-xl ml-1">P</span></p>
        </div>

        {/* 액션 버튼 */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <Link href="/member/earn" className="bg-white/20 hover:bg-white/30 rounded-xl py-3 text-center text-sm font-medium transition-colors">
            포인트 적립
          </Link>
          <Link href="/member/use" className="bg-white/20 hover:bg-white/30 rounded-xl py-3 text-center text-sm font-medium transition-colors">
            포인트 사용
          </Link>
        </div>
      </div>

      {/* 최근 이력 */}
      <div className="px-4 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-900">최근 이용내역</h2>
          <Link href="/member/history" className="text-primary text-sm">전체보기</Link>
        </div>

        <div className="card space-y-0 p-0 overflow-hidden">
          {history.length === 0 && (
            <p className="text-gray-400 text-center py-8 text-sm">이용 내역이 없습니다.</p>
          )}
          {history.map((tx, i) => (
            <div
              key={tx.id}
              className={`flex items-center justify-between p-4 ${i < history.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm
                  ${tx.type === 'EARN' ? 'bg-green-50' : tx.type === 'USE' ? 'bg-red-50' : 'bg-gray-50'}`}>
                  {tx.type === 'EARN' ? '↑' : tx.type === 'USE' ? '↓' : '○'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{tx.description || tx.source}</p>
                  <p className="text-xs text-gray-400">{dayjs(tx.createdAt).format('MM.DD HH:mm')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${TYPE_COLOR[tx.type]}`}>
                  {TYPE_LABEL[tx.type]} {tx.amount.toLocaleString()}P
                </p>
                <p className="text-xs text-gray-400">{tx.balanceAfter.toLocaleString()}P</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
