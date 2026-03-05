'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../utils/api';
import { useAdminAuthStore } from '../../../store/adminAuth.store';
import { User, PaginatedResult } from '../../../types';
import dayjs from 'dayjs';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  SUSPENDED: 'bg-red-100 text-red-700',
  DELETED: 'bg-gray-200 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성', INACTIVE: '비활성', SUSPENDED: '정지', DELETED: '탈퇴',
};

export default function AdminUsersPage() {
  const { isAuthenticated, _hasHydrated } = useAdminAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adjustModal, setAdjustModal] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, status],
    queryFn: () => adminApi.getUsers({ page, limit: 20, search, status }),
    enabled: _hasHydrated && isAuthenticated, // 인증 완료 전 API 호출 차단
  });

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/admin/login');
  }, [_hasHydrated, isAuthenticated, router]);

  // hydration 완료 전 또는 미인증 상태: 빈 화면 (콘텐츠 노출 방지)
  if (!_hasHydrated || !isAuthenticated) return null;

  const result: PaginatedResult<User> = (res as any)?.data ?? { items: [], total: 0, totalPages: 1 };

  const statusMutation = useMutation({
    mutationFn: ({ userId, status, reason }: any) =>
      adminApi.updateUserStatus(userId, status, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const adjustMutation = useMutation({
    mutationFn: (data: any) => adminApi.adjustPoints(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setAdjustModal(false);
    },
  });

  const handleAdjust = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    adjustMutation.mutate({
      userId: selectedUser?.id,
      amount: parseInt(formData.get('amount') as string),
      adjustType: formData.get('adjustType'),
      reason: formData.get('reason'),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <a href="/admin/dashboard" className="text-gray-400">← 대시보드</a>
        <h1 className="text-xl font-bold">회원 관리</h1>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* 필터 */}
        <div className="card flex gap-3 flex-wrap">
          <input
            placeholder="이름/전화번호/이메일 검색"
            className="input-field flex-1 min-w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
          />
          <select className="input-field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">전체 상태</option>
            {['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'].map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <button className="btn-primary w-auto px-6" onClick={() => setPage(1)}>검색</button>
        </div>

        {/* 테이블 */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['이름', '전화번호', '이메일', '상태', '포인트', '가입일', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">로딩중...</td></tr>
                ) : result.items.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{user.email || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[user.status]}`}>
                        {STATUS_LABEL[user.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{user.pointBalance.toLocaleString()}P</td>
                    <td className="px-4 py-3 text-gray-500">{dayjs(user.createdAt).format('YYYY.MM.DD')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelectedUser(user); setAdjustModal(true); }}
                          className="text-xs px-2 py-1 bg-primary text-white rounded"
                        >포인트 지급</button>
                        {user.status === 'ACTIVE' ? (
                          <button
                            onClick={() => statusMutation.mutate({ userId: user.id, status: 'SUSPENDED', reason: '관리자 정지' })}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                          >정지</button>
                        ) : (
                          <button
                            onClick={() => statusMutation.mutate({ userId: user.id, status: 'ACTIVE', reason: '정지 해제' })}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                          >활성화</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">총 {result.total.toLocaleString()}명</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40">이전</button>
              <span className="px-3 py-1 text-sm">{page} / {result.totalPages}</span>
              <button disabled={page >= result.totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40">다음</button>
            </div>
          </div>
        </div>
      </div>

      {/* 포인트 지급 모달 */}
      {adjustModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
            <h3 className="font-bold text-lg mb-1">포인트 수동 지급/차감</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedUser.name} ({selectedUser.phone})</p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">유형</label>
                <select name="adjustType" className="input-field">
                  <option value="EARN">지급 (+)</option>
                  <option value="USE">차감 (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">포인트</label>
                <input name="amount" type="number" min="1" className="input-field" placeholder="0" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">사유 (필수)</label>
                <input name="reason" className="input-field" placeholder="사유 입력" required />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAdjustModal(false)} className="btn-secondary flex-1">취소</button>
                <button type="submit" disabled={adjustMutation.isPending} className="btn-primary flex-1">
                  {adjustMutation.isPending ? '처리중...' : '확인'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
