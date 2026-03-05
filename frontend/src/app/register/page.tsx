'use client';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="card max-w-md w-full text-center space-y-4">
        <div className="text-4xl">📝</div>
        <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
        <p className="text-gray-500 text-sm">
          회원가입 기능은 현재 준비 중입니다.<br />
          통신사 본인인증(NICE) 연동 후 제공될 예정입니다.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
          개발 환경에서는 관리자가 직접 계정을 발급합니다.
        </div>
        <button
          onClick={() => router.push('/login')}
          className="btn-primary w-full"
        >
          로그인으로 돌아가기
        </button>
      </div>
    </div>
  );
}
