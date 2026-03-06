'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../utils/api';
import { useAuthStore } from '../../store/auth.store';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const res: any = await authApi.login(data.email, data.password);
      setAuth(res.data.user, res.data.tokens.accessToken, res.data.tokens.refreshToken);
      document.cookie = 'member_auth=1; path=/; max-age=86400; SameSite=Lax';
      router.replace('/member/dashboard');
    } catch (e: any) {
      setError(e?.message || e?.error?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">포인트 시스템</h1>
          <p className="text-gray-500 text-sm mt-1">적립하고 사용하세요</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
            <input
              {...register('email')}
              type="email"
              placeholder="user@example.com"
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
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 소셜 로그인 */}
        <div className="mt-4 space-y-2">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/auth/kakao`}
            className="flex items-center justify-center gap-3 w-full py-3 bg-[#FEE500] rounded-xl font-medium text-gray-900"
          >
            <span>카카오로 시작하기</span>
          </a>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/auth/naver`}
            className="flex items-center justify-center gap-3 w-full py-3 bg-[#03C75A] rounded-xl font-medium text-white"
          >
            <span>네이버로 시작하기</span>
          </a>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          계정이 없으신가요?{' '}
          <a href="/register" className="text-primary font-medium">회원가입</a>
        </p>
      </div>
    </div>
  );
}
