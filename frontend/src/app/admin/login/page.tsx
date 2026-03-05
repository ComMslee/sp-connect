'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminAuthApi } from '../../../utils/api';
import { useAdminAuthStore } from '../../../store/adminAuth.store';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAdminAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const res: any = await adminAuthApi.login(data.email, data.password);
      setAuth(res.data.admin, res.data.tokens.accessToken);
      // middleware 라우트 보호용 쿠키 설정 (24시간)
      document.cookie = 'admin_auth=1; path=/; max-age=86400; SameSite=Lax';
      router.replace('/admin/dashboard');
    } catch (e: any) {
      setError(e?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">관리자 로그인</h1>
          <p className="text-gray-400 text-sm mt-1">포인트 시스템 관리자 페이지</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
            <input
              {...register('email')}
              type="email"
              placeholder="admin@example.com"
              className="input-field"
              autoComplete="email"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
            <input
              {...register('password')}
              type="password"
              placeholder="비밀번호 입력"
              className="input-field"
              autoComplete="current-password"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '로그인 중...' : '관리자 로그인'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          <a href="/login" className="text-gray-400 hover:text-gray-300">회원 로그인으로 돌아가기</a>
        </p>
      </div>
    </div>
  );
}
