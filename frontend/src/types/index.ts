export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
  pointBalance: number;
  isVerified: boolean;
  authProvider: 'LOCAL' | 'KAKAO' | 'NAVER' | 'TELECOM';
  createdAt: string;
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
