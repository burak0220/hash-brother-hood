import axios from 'axios';
import type {
  User, Algorithm, Rig, RigListResponse, Rental, RentalListResponse,
  Transaction, TransactionListResponse, Notification, NotificationListResponse,
  Review, TokenResponse, AdminStats, PlatformSetting,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post<User>('/auth/register', data),
  login: (data: { email: string; password: string; totp_code?: string }) =>
    api.post<TokenResponse>('/auth/login', data),
  refresh: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }),
  enable2FA: () => api.post<{ secret: string; uri: string }>('/auth/2fa/enable'),
  verify2FA: (code: string) => api.post('/auth/2fa/verify', { code }),
  disable2FA: (code: string) => api.post('/auth/2fa/disable', { code }),
};

// Users
export const usersAPI = {
  me: () => api.get<User>('/users/me'),
  update: (data: { username?: string; bio?: string; avatar_url?: string }) =>
    api.put<User>('/users/me', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/users/me/password', data),
};

// Algorithms
export const algorithmsAPI = {
  list: () => api.get<Algorithm[]>('/algorithms'),
  create: (data: { display_name: string; unit: string }) =>
    api.post<Algorithm>('/algorithms', data),
};

// Rigs
export const rigsAPI = {
  marketplace: (params?: Record<string, any>) =>
    api.get<RigListResponse>('/rigs/marketplace', { params }),
  myRigs: () => api.get<Rig[]>('/rigs/my-rigs'),
  get: (id: number) => api.get<Rig>(`/rigs/${id}`),
  create: (data: any) => api.post<Rig>('/rigs', data),
  update: (id: number, data: any) => api.put<Rig>(`/rigs/${id}`, data),
  delete: (id: number) => api.delete(`/rigs/${id}`),
};

// Rentals
export const rentalsAPI = {
  create: (data: { rig_id: number; duration_hours: number; pool_url: string; pool_user: string; pool_password?: string }) =>
    api.post<Rental>('/rentals', data),
  list: (params?: { role?: string; page?: number; per_page?: number }) =>
    api.get<RentalListResponse>('/rentals', { params }),
  get: (id: number) => api.get<Rental>(`/rentals/${id}`),
  cancel: (id: number) => api.post<Rental>(`/rentals/${id}/cancel`),
};

// Payments
export const paymentsAPI = {
  balance: () => api.get<{ balance: number }>('/payments/balance'),
  platformAddress: () => api.get<{ address: string }>('/payments/platform-address'),
  deposit: (data: { amount: number; tx_hash: string }) =>
    api.post<Transaction>('/payments/deposit', data),
  verifyDeposit: (txId: number) =>
    api.post<Transaction>(`/payments/deposit/${txId}/verify`),
  withdraw: (data: { amount: number; wallet_address: string }) =>
    api.post<Transaction>('/payments/withdraw', data),
  transactions: (params?: { page?: number; per_page?: number; type?: string }) =>
    api.get<TransactionListResponse>('/payments/transactions', { params }),
};

// Notifications
export const notificationsAPI = {
  list: (limit?: number) => api.get<NotificationListResponse>('/notifications', { params: { limit } }),
  markRead: (notificationId?: number) =>
    api.post('/notifications/mark-read', null, { params: { notification_id: notificationId } }),
};

// Reviews
export const reviewsAPI = {
  create: (data: { rental_id: number; rating: number; comment?: string }) =>
    api.post<Review>('/reviews', data),
  rigReviews: (rigId: number) => api.get<Review[]>(`/reviews/rig/${rigId}`),
};

// Admin
export const adminAPI = {
  stats: () => api.get<AdminStats>('/admin/stats'),
  // Users
  users: (params?: { page?: number; per_page?: number }) =>
    api.get<User[]>('/admin/users', { params }),
  updateUser: (id: number, data: any) => api.put<User>(`/admin/users/${id}`, data),
  adjustBalance: (id: number, data: { amount: number; reason: string }) =>
    api.post(`/admin/users/${id}/adjust-balance`, data),
  // Rigs
  rigs: (params?: { page?: number; per_page?: number }) =>
    api.get('/admin/rigs', { params }),
  deleteRig: (id: number) => api.delete(`/admin/rigs/${id}`),
  toggleFeatureRig: (id: number) => api.put(`/admin/rigs/${id}/feature`),
  // Algorithms
  algorithms: () => api.get('/admin/algorithms'),
  updateAlgorithm: (id: number, data: any) => api.put(`/admin/algorithms/${id}`, data),
  deleteAlgorithm: (id: number) => api.delete(`/admin/algorithms/${id}`),
  // Rentals
  rentals: (params?: { page?: number; per_page?: number; status?: string }) =>
    api.get('/admin/rentals', { params }),
  cancelRental: (id: number) => api.post(`/admin/rentals/${id}/cancel`),
  // Withdrawals
  pendingWithdrawals: () => api.get<Transaction[]>('/admin/withdrawals'),
  approveWithdrawal: (id: number) => api.post(`/admin/withdrawals/${id}/approve`),
  rejectWithdrawal: (id: number) => api.post(`/admin/withdrawals/${id}/reject`),
  // Transactions
  transactions: (params?: { page?: number; per_page?: number; type?: string }) =>
    api.get('/admin/transactions', { params }),
  // Notifications
  sendNotification: (data: { user_id?: number; title: string; message: string; link?: string }) =>
    api.post('/admin/notifications/send', data),
  // Audit logs
  auditLogs: (params?: { page?: number; per_page?: number }) =>
    api.get('/admin/audit-logs', { params }),
  // Hot Wallet
  walletBalance: () => api.get<{ usdt_balance: number; bnb_balance: number }>('/admin/wallet-balance'),
  // Settings
  settings: () => api.get<PlatformSetting[]>('/admin/settings'),
  updateSetting: (key: string, value: string) =>
    api.put<PlatformSetting>(`/admin/settings/${key}`, { value }),
};

export default api;
