import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 요청 인터셉터 - JWT 자동 첨부
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
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

export const adminApi = {
  getDashboard: (params?: any) => apiClient.get('/admin/dashboard/stats', { params }),
  getUsers: (params: any) => apiClient.get('/admin/users', { params }),
  getUserDetail: (userId: string) => apiClient.get(`/admin/users/${userId}`),
  updateUserStatus: (userId: string, status: string, reason?: string) =>
    apiClient.patch(`/admin/users/${userId}/status`, { status, reason }),
  adjustPoints: (data: any) => apiClient.post('/admin/points/adjust', data),
  getPointHistory: (params: any) => apiClient.get('/admin/points/history', { params }),
  getPolicies: () => apiClient.get('/admin/policies'),
  createPolicy: (data: any) => apiClient.post('/admin/policies', data),
  getExternalSites: () => apiClient.get('/admin/external-sites'),
  createExternalSite: (data: any) => apiClient.post('/admin/external-sites', data),
};
