'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../../utils/api';
import { useAdminAuthStore } from '../../../store/adminAuth.store';
import { DashboardStats } from '../../../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';

const StatCard = ({ title, value, unit = '', color = 'text-gray-900' }: any) => (
  <div className="card">
    <p className="text-sm text-gray-500 mb-1">{title}</p>
    <p className={`text-2xl font-bold ${color}`}>
      {typeof value === 'number' ? value.toLocaleString() : value}
      <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
    </p>
  </div>
);

export default function AdminDashboardPage() {
  const { isAuthenticated, _hasHydrated } = useAdminAuthStore();
  const router = useRouter();
  const [period, setPeriod] = useState({ startDate: '', endDate: '' });

  const { data: statsRes, isLoading } = useQuery({
    queryKey: ['admin-dashboard', period],
    queryFn: () => adminApi.getDashboard(period),
    enabled: _hasHydrated && isAuthenticated, // 인증 완료 전 API 호출 차단
  });

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/admin/login');
  }, [_hasHydrated, isAuthenticated, router]);

  // hydration 완료 전 또는 미인증 상태: 빈 화면 (콘텐츠 노출 방지)
  if (!_hasHydrated || !isAuthenticated) return null;

  const stats: DashboardStats | undefined = (statsRes as any)?.data;

  const chartData = stats ? [
    { name: '총 발행', value: stats.points.totalEarned, fill: '#10B981' },
    { name: '총 사용', value: stats.points.totalUsed, fill: '#EF4444' },
    { name: '총 만료', value: stats.points.totalExpired, fill: '#9CA3AF' },
    { name: '현재 잔액', value: stats.points.totalBalance, fill: '#3B82F6' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 네비 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">관리자 대시보드</h1>
        <nav className="flex gap-6 text-sm">
          <a href="/admin/users" className="text-gray-600 hover:text-primary">회원관리</a>
          <a href="/admin/points" className="text-gray-600 hover:text-primary">포인트이력</a>
          <a href="/admin/policies" className="text-gray-600 hover:text-primary">정책설정</a>
          <a href="/admin/sites" className="text-gray-600 hover:text-primary">연동사이트</a>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* 기간 필터 */}
        <div className="card flex gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">시작일</label>
            <input type="date" className="input-field w-auto"
              onChange={(e) => setPeriod(p => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">종료일</label>
            <input type="date" className="input-field w-auto"
              onChange={(e) => setPeriod(p => ({ ...p, endDate: e.target.value }))} />
          </div>
          <button className="btn-primary w-auto px-6">조회</button>
        </div>

        {/* 핵심 지표 카드 */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="card animate-pulse h-24 bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="총 발행 포인트" value={stats?.points.totalEarned} unit="P" color="text-green-600" />
            <StatCard title="총 사용 포인트" value={stats?.points.totalUsed} unit="P" color="text-red-500" />
            <StatCard title="유효 잔액 합계" value={stats?.points.totalBalance} unit="P" color="text-blue-600" />
            <StatCard title="전체 회원" value={stats?.users.total} unit="명" />
          </div>
        )}

        {/* 추가 지표 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="적립 건수" value={stats.points.earnCount} unit="건" />
            <StatCard title="사용 건수" value={stats.points.useCount} unit="건" />
            <StatCard title="활성 회원" value={stats.users.active} unit="명" />
            <StatCard title="만료 포인트" value={stats.points.totalExpired} unit="P" color="text-gray-500" />
          </div>
        )}

        {/* 차트 */}
        {stats && (
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-6">포인트 현황</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()}P`, '']} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <rect key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 빠른 접근 */}
        <div className="grid md:grid-cols-3 gap-4">
          <a href="/admin/users" className="card hover:shadow-md transition-shadow cursor-pointer group">
            <h3 className="font-semibold text-gray-900 group-hover:text-primary">회원 관리 →</h3>
            <p className="text-sm text-gray-500 mt-1">사용자 조회, 상태 변경, 포인트 수동 지급</p>
          </a>
          <a href="/admin/points" className="card hover:shadow-md transition-shadow cursor-pointer group">
            <h3 className="font-semibold text-gray-900 group-hover:text-primary">포인트 이력 →</h3>
            <p className="text-sm text-gray-500 mt-1">기간별, 유형별, 사용자별 상세 필터링</p>
          </a>
          <a href="/admin/sites" className="card hover:shadow-md transition-shadow cursor-pointer group">
            <h3 className="font-semibold text-gray-900 group-hover:text-primary">외부 연동 →</h3>
            <p className="text-sm text-gray-500 mt-1">외부 사이트 API 키 관리 및 발급</p>
          </a>
        </div>
      </div>
    </div>
  );
}
