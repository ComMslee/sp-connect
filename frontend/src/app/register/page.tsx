'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../utils/api';

/* ───────────── Zod schema ───────────── */
const step2Schema = z
  .object({
    email: z.string().email('올바른 이메일 주소를 입력해주세요'),
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다')
      .regex(/[A-Za-z]/, '영문자를 포함해주세요')
      .regex(/[0-9]/, '숫자를 포함해주세요'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });
type Step2Form = z.infer<typeof step2Schema>;

/* ───────────── Inner component (useSearchParams 사용) ───────────── */
function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const socialToken = searchParams.get('socialToken') ?? undefined;

  /* 단계 상태 */
  const [step, setStep] = useState<1 | 2>(1);

  /* Step 1 – 본인인증 결과 */
  const [telecomName, setTelecomName] = useState('');
  const [telecomPhone, setTelecomPhone] = useState('');
  const [telecomCi, setTelecomCi] = useState('');
  const [telecomDi, setTelecomDi] = useState('');

  /* 소셜 pre-fill */
  const [socialEmail, setSocialEmail] = useState('');
  const [socialProvider, setSocialProvider] = useState('');

  /* UI 상태 */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [telecomWindow, setTelecomWindow] = useState<Window | null>(null);

  /* Step 2 폼 */
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Step2Form>({ resolver: zodResolver(step2Schema) });

  /* ── socialToken 이 있으면 프로필 pre-fill ── */
  useEffect(() => {
    if (!socialToken) return;
    authApi
      .getSocialProfile(socialToken)
      .then((res: any) => {
        const profile = res?.data ?? res;
        if (profile?.email) {
          setSocialEmail(profile.email);
          setValue('email', profile.email);
        }
        if (profile?.provider) setSocialProvider(profile.provider);
      })
      .catch(() => {
        /* 토큰 만료 등 – 무시하고 빈 폼 표시 */
      });
  }, [socialToken, setValue]);

  /* ── 본인인증 팝업 + postMessage 수신 ── */
  const handleTelecomRequest = async () => {
    setLoading(true);
    setError('');
    try {
      const returnUrl = `${window.location.origin}/auth/telecom/callback`;
      const res: any = await authApi.telecomRequest(returnUrl);
      const { url } = res?.data ?? res;
      const popup = window.open(url, 'telecom', 'width=500,height=600,scrollbars=yes');
      setTelecomWindow(popup);
    } catch (e: any) {
      setError(e?.message || '본인인증 요청에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.data?.type !== 'TELECOM_CALLBACK') return;
      const { encData } = event.data;
      setLoading(true);
      setError('');
      try {
        const res: any = await authApi.telecomVerify(encData);
        const info = res?.data ?? res;
        setTelecomName(info.name ?? '');
        setTelecomPhone(info.phone ?? '');
        setTelecomCi(info.ci ?? '');
        setTelecomDi(info.di ?? '');
        setStep(2);
        telecomWindow?.close();
      } catch (e: any) {
        setError(e?.message || '본인인증 확인에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [telecomWindow]);

  /* ── Step 2 제출 ── */
  const onSubmit = async (data: Step2Form) => {
    setLoading(true);
    setError('');
    try {
      const payload: any = {
        name: telecomName,
        phone: telecomPhone,
        email: data.email,
        password: data.password,
        ci: telecomCi,
        di: telecomDi,
      };
      if (socialToken) payload.socialToken = socialToken;

      const res: any = await authApi.register(payload);
      const { tokens, user } = res?.data ?? res;

      /* 가입 성공 → 자동 로그인 */
      if (tokens?.accessToken) {
        /* Zustand store 없이 직접 저장 – 로그인 페이지에서 처리하도록 redirect */
        router.replace('/login?registered=1');
      } else {
        router.replace('/login?registered=1');
      }
    } catch (e: any) {
      setError(e?.message || e?.error?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /* ──────────── Render ──────────── */
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="text-gray-500 text-sm mt-1">포인트 시스템에 오신 것을 환영합니다</p>
        </div>

        {/* 진행 단계 표시 */}
        <div className="flex items-center justify-center mb-6 gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            1
          </div>
          <div className={`h-1 w-12 rounded ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            2
          </div>
        </div>

        {/* ── STEP 1: 본인인증 ── */}
        {step === 1 && (
          <div className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">본인인증</h2>
              <p className="text-sm text-gray-500 mt-1">
                회원가입을 위해 통신사 본인인증이 필요합니다.
              </p>
            </div>

            {socialToken && socialProvider && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <strong>{socialProvider === 'KAKAO' ? '카카오' : '네이버'}</strong> 계정과 연동하여 가입합니다.
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">✓</span>
                <span>이름, 생년월일, 성별을 확인합니다</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">✓</span>
                <span>휴대폰 번호로 본인을 확인합니다</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">✓</span>
                <span>중복 가입 방지를 위해 CI/DI를 수집합니다</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
            )}

            <button
              onClick={handleTelecomRequest}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? '처리 중...' : '통신사 본인인증 시작'}
            </button>

            <p className="text-center text-sm text-gray-500">
              이미 계정이 있으신가요?{' '}
              <a href="/login" className="text-primary font-medium">로그인</a>
            </p>
          </div>
        )}

        {/* ── STEP 2: 계정 정보 입력 ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">계정 정보 설정</h2>
              <p className="text-sm text-gray-500 mt-1">
                본인인증이 완료되었습니다. 이메일과 비밀번호를 설정해주세요.
              </p>
            </div>

            {/* 본인인증 정보 (읽기 전용) */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-green-700 mb-2">✓ 본인인증 완료</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">이름</span>
                <span className="font-medium text-gray-900">{telecomName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">휴대폰</span>
                <span className="font-medium text-gray-900">
                  {telecomPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                </span>
              </div>
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                {...register('email')}
                type="email"
                placeholder="user@example.com"
                className="input-field"
                autoComplete="email"
                defaultValue={socialEmail}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
              {socialEmail && (
                <p className="text-blue-500 text-xs mt-1">소셜 계정에서 가져온 이메일입니다</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <input
                {...register('password')}
                type="password"
                placeholder="영문+숫자 8자 이상"
                className="input-field"
                autoComplete="new-password"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
              <input
                {...register('confirmPassword')}
                type="password"
                placeholder="비밀번호 재입력"
                className="input-field"
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '가입 중...' : '회원가입 완료'}
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← 본인인증 다시 하기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ───────────── Export with Suspense (useSearchParams 필요) ───────────── */
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    }>
      <RegisterInner />
    </Suspense>
  );
}
