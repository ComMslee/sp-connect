'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '../../../../utils/api';
import { useAuthStore } from '../../../../store/auth.store';

/**
 * 소셜 로그인 콜백 페이지
 *
 * 백엔드 리다이렉트 케이스:
 *   Case A (연결된 계정 있음): ?token=ACCESS&refresh=REFRESH  → 자동 로그인 후 대시보드
 *   Case B (연결 없음):        ?socialToken=TEMP_JWT          → 로그인 중이면 연동, 아니면 회원가입
 */
function SocialCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, accessToken: storedToken } = useAuthStore();
  const [message, setMessage] = useState('처리 중...');
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = async () => {
      const token = searchParams.get('token');
      const refresh = searchParams.get('refresh');
      const socialToken = searchParams.get('socialToken');
      const errorParam = searchParams.get('error');

      /* 오류 파라미터 */
      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        setTimeout(() => router.replace('/login'), 3000);
        return;
      }

      /* ── Case A: 로그인 완료 (token + refresh) ── */
      if (token && refresh) {
        setMessage('로그인 중...');
        try {
          /* 유저 정보 조회 후 store에 저장 */
          const meRes: any = await authApi.getMe();
          const user = meRes?.data ?? meRes;
          setAuth(user, token, refresh);
          document.cookie = 'member_auth=1; path=/; max-age=86400; SameSite=Lax';
          setMessage('로그인 성공! 대시보드로 이동합니다.');
          router.replace('/member/dashboard');
        } catch {
          /* getMe 실패 시 더미로 진행 */
          setAuth({ id: '', name: '', email: '' } as any, token, refresh);
          document.cookie = 'member_auth=1; path=/; max-age=86400; SameSite=Lax';
          router.replace('/member/dashboard');
        }
        return;
      }

      /* ── Case B: socialToken 받은 경우 ── */
      if (socialToken) {
        /* 이미 로그인되어 있으면 → 자동 연동 */
        if (storedToken) {
          setMessage('소셜 계정 연동 중...');
          try {
            await authApi.linkSocial(socialToken);
            setMessage('연동 완료! 대시보드로 이동합니다.');
            router.replace('/member/dashboard?linked=1');
          } catch (e: any) {
            setError(e?.message || '소셜 연동에 실패했습니다.');
            setTimeout(() => router.replace('/member/dashboard'), 3000);
          }
          return;
        }

        /* 로그인 안 된 상태 → 회원가입 페이지로 (socialToken 전달) */
        setMessage('회원가입 페이지로 이동합니다...');
        router.replace(`/register?socialToken=${encodeURIComponent(socialToken)}`);
        return;
      }

      /* 파라미터 없음 */
      setError('잘못된 접근입니다.');
      setTimeout(() => router.replace('/login'), 3000);
    };

    handle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="card max-w-sm w-full text-center space-y-4">
        {error ? (
          <>
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-900">오류 발생</h2>
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-gray-400">잠시 후 로그인 페이지로 이동합니다...</p>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <svg
                className="animate-spin h-10 w-10 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SocialCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">처리 중...</div>
      </div>
    }>
      <SocialCallbackInner />
    </Suspense>
  );
}
