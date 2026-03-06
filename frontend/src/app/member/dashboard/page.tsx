'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../store/auth.store';
import { pointsApi, authApi } from '../../../utils/api';
import { PointTransaction, SocialProvider } from '../../../types';
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
  const queryClient = useQueryClient();
  const [socialError, setSocialError] = useState('');
  const [socialSuccess, setSocialSuccess] = useState('');

  /* ── 쿼리 ── */
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

  const { data: socialsData, isLoading: socialsLoading } = useQuery({
    queryKey: ['my-socials'],
    queryFn: () => authApi.getMySocials(),
    enabled: _hasHydrated && isAuthenticated,
  });

  /* ── 소셜 연결 해제 mutation ── */
  const unlinkMutation = useMutation({
    mutationFn: (provider: string) => authApi.unlinkSocial(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-socials'] });
      setSocialSuccess('연동이 해제되었습니다.');
      setTimeout(() => setSocialSuccess(''), 3000);
    },
    onError: (e: any) => {
      setSocialError(e?.message || '연동 해제에 실패했습니다.');
      setTimeout(() => setSocialError(''), 3000);
    },
  });

  /* ── 인증 체크 ── */
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      document.cookie = 'member_auth=; path=/; max-age=0';
      window.location.href = '/login';
    }
  }, [_hasHydrated, isAuthenticated]);

  /* ── linked=1 파라미터 처리 (소셜 연동 완료 메시지) ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('linked') === '1') {
      setSocialSuccess('소셜 계정이 연동되었습니다!');
      queryClient.invalidateQueries({ queryKey: ['my-socials'] });
      window.history.replaceState({}, '', '/member/dashboard');
      setTimeout(() => setSocialSuccess(''), 4000);
    }
  }, [queryClient]);

  if (!_hasHydrated) return <div className="min-h-screen bg-gray-50" />;
  if (!isAuthenticated) return null;

  const balance = (balanceData as any)?.data?.balance ?? user?.pointBalance ?? 0;
  const history: PointTransaction[] = (historyData as any)?.data?.items ?? [];
  const linkedProviders: SocialProvider[] = (socialsData as any)?.data ?? [];

  const isKakaoLinked = linkedProviders.some((p) => p.provider === 'KAKAO');
  const isNaverLinked = linkedProviders.some((p) => p.provider === 'NAVER');

  const handleLogout = () => {
    clearAuth();
    document.cookie = 'member_auth=; path=/; max-age=0';
    window.location.href = '/login';
  };

  const handleUnlink = (provider: string) => {
    if (!confirm(`${provider === 'KAKAO' ? '카카오' : '네이버'} 연동을 해제하시겠습니까?`)) return;
    unlinkMutation.mutate(provider);
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 상단 헤더 */}
      <div className="bg-primary text-white px-4 pt-12 pb-8 rounded-b-3xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-blue-100 text-sm">{user?.name}님 안녕하세요</p>
            <p className="text-xs text-blue-200">{user?.email}</p>
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

      {/* 소셜 계정 연동 */}
      <div className="px-4 mt-6">
        <h2 className="font-bold text-gray-900 mb-3">소셜 계정 연동</h2>

        {(socialError || socialSuccess) && (
          <div className={`mb-3 p-3 rounded-lg text-sm ${socialError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
            {socialError || socialSuccess}
          </div>
        )}

        <div className="card space-y-3">
          {/* 카카오 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEE500] flex items-center justify-center text-sm font-bold text-gray-900">K</div>
              <div>
                <p className="text-sm font-medium text-gray-900">카카오</p>
                {isKakaoLinked ? (
                  <p className="text-xs text-green-600">연동됨</p>
                ) : (
                  <p className="text-xs text-gray-400">연동 안됨</p>
                )}
              </div>
            </div>
            {isKakaoLinked ? (
              <button
                onClick={() => handleUnlink('KAKAO')}
                disabled={unlinkMutation.isPending}
                className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                연동 해제
              </button>
            ) : (
              <a
                href={`${API_URL}/auth/kakao`}
                className="text-xs text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                연동하기
              </a>
            )}
          </div>

          <div className="border-t border-gray-50" />

          {/* 네이버 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#03C75A] flex items-center justify-center text-sm font-bold text-white">N</div>
              <div>
                <p className="text-sm font-medium text-gray-900">네이버</p>
                {isNaverLinked ? (
                  <p className="text-xs text-green-600">연동됨</p>
                ) : (
                  <p className="text-xs text-gray-400">연동 안됨</p>
                )}
              </div>
            </div>
            {isNaverLinked ? (
              <button
                onClick={() => handleUnlink('NAVER')}
                disabled={unlinkMutation.isPending}
                className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                연동 해제
              </button>
            ) : (
              <a
                href={`${API_URL}/auth/naver`}
                className="text-xs text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                연동하기
              </a>
            )}
          </div>
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
