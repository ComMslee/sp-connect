export interface User {
  id: string;
  name: string;
  email: string;           // 로그인 식별자 (필수)
  phone: string;           // 본인인증으로 획득
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
  pointBalance: number;
  isVerified: boolean;
  authProvider: 'LOCAL' | 'KAKAO' | 'NAVER' | 'TELECOM';
  createdAt: string;
}

/** 소셜 연동 정보 (GET /auth/me/socials 응답) */
export interface SocialProvider {
  provider: 'KAKAO' | 'NAVER';
  connectedAt: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  type: 'EARN' | 'USE' | 'EXPIRE' | 'CANCEL' | 'ADJUST';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  source: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  referenceId?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  period: { startDate: string; endDate: string };
  users: { total: number; active: number };
  points: {
    totalEarned: number;
    totalUsed: number;
    totalExpired: number;
    totalBalance: number;
    earnCount: number;
    useCount: number;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}
