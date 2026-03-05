import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

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
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data.data.tokens;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefresh);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error.response?.data || error);
  },
);

// API 함수들
export const authApi = {
  login: (phone: string, password: string) =>
    apiClient.post('/auth/login', { phone, password }),
  register: (data: any) => apiClient.post('/auth/register', data),
  refresh: (refreshToken: string) => apiClient.post('/auth/refresh', { refreshToken }),
  logout: () => apiClient.post('/auth/logout'),
  telecomRequest: (returnUrl: string) =>
    apiClient.get(`/auth/telecom/request?returnUrl=${returnUrl}`),
  telecomVerify: (encData: string) =>
    apiClient.post('/auth/telecom/verify', { encData }),
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
        localStorage.removeItem('adminAccessToken');
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
