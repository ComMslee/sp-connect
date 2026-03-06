import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth.store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Zustand persist 저장소에서 토큰 읽기
const getMemberToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    return raw ? JSON.parse(raw)?.state?.accessToken ?? null : null;
  } catch { return null; }
};

const getAdminToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('admin-auth-storage');
    return raw ? JSON.parse(raw)?.state?.accessToken ?? null : null;
  } catch { return null; }
};

// 요청 인터셉터 - JWT 자동 첨부
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getMemberToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터 - 401 시 토큰 갱신
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // Zustand persist 저장소에서 refreshToken 읽기
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data.data.tokens;
          // localStorage 직접 쓰기 대신 Zustand store 업데이트 (persist가 localStorage 동기화)
          useAuthStore.getState().setTokens(accessToken, newRefresh);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch {
          useAuthStore.getState().clearAuth();
          document.cookie = 'member_auth=; path=/; max-age=0'; // middleware 쿠키 제거
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error.response?.data || error);
  },
);

// API 함수들
export const authApi = {
  /** 이메일+비밀번호 로그인 */
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (data: any) => apiClient.post('/auth/register', data),
  refresh: (refreshToken: string) => apiClient.post('/auth/refresh', { refreshToken }),
  logout: () => apiClient.post('/auth/logout'),
  /** 현재 로그인 유저 정보 조회 */
  getMe: () => apiClient.get('/auth/me'),
  telecomRequest: (returnUrl: string) =>
    apiClient.get(`/auth/telecom/request?returnUrl=${encodeURIComponent(returnUrl)}`),
  telecomVerify: (encData: string) =>
    apiClient.post('/auth/telecom/verify', { encData }),
  /** 소셜 임시 토큰에서 프로필 조회 (가입 pre-fill용) */
  getSocialProfile: (token: string) =>
    apiClient.get(`/auth/social/profile?token=${encodeURIComponent(token)}`),
  /** 내 소셜 연동 목록 */
  getMySocials: () => apiClient.get('/auth/me/socials'),
  /** 소셜 계정 연동 */
  linkSocial: (socialToken: string) =>
    apiClient.post('/auth/social/link', { socialToken }),
  /** 소셜 계정 연동 해제 */
  unlinkSocial: (provider: string) =>
    apiClient.delete(`/auth/social/unlink/${provider}`),
};

export const pointsApi = {
  getBalance: () => apiClient.get('/points/balance'),
  getHistory: (params: any) => apiClient.get('/points/history', { params }),
  earn: (data: any) => apiClient.post('/points/earn', data),
  use: (data: any) => apiClient.post('/points/use', data),
  cancel: (transactionId: string, reason?: string) =>
    apiClient.post('/points/cancel', { transactionId, reason }),
};

// 관리자 전용 API 클라이언트 (adminAccessToken 사용)
export const adminApiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

adminApiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin-auth-storage'); // Zustand persist 키와 일치
        document.cookie = 'admin_auth=; path=/; max-age=0'; // middleware 쿠키 제거
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error.response?.data || error);
  },
);

export const adminAuthApi = {
  login: (email: string, password: string) =>
    adminApiClient.post('/admin/auth/login', { email, password }),
};

export const adminApi = {
  getDashboard: (params?: any) => adminApiClient.get('/admin/dashboard/stats', { params }),
  getUsers: (params: any) => adminApiClient.get('/admin/users', { params }),
  getUserDetail: (userId: string) => adminApiClient.get(`/admin/users/${userId}`),
  updateUserStatus: (userId: string, status: string, reason?: string) =>
    adminApiClient.patch(`/admin/users/${userId}/status`, { status, reason }),
  adjustPoints: (data: any) => adminApiClient.post('/admin/points/adjust', data),
  getPointHistory: (params: any) => adminApiClient.get('/admin/points/history', { params }),
  getPolicies: () => adminApiClient.get('/admin/policies'),
  createPolicy: (data: any) => adminApiClient.post('/admin/policies', data),
  getExternalSites: () => adminApiClient.get('/admin/external-sites'),
  createExternalSite: (data: any) => adminApiClient.post('/admin/external-sites', data),
};
