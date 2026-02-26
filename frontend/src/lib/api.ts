import axios from 'axios';
import type {
  User, Algorithm, Rig, RigListResponse, Rental, RentalListResponse, RentalConversation,
  Transaction, TransactionListResponse, Notification, NotificationListResponse,
  Review, TokenResponse, AdminStats, PlatformSetting, MessageItem, Conversation,
  Dispute, PoolProfile, RentalMessage,
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

// Mutex for token refresh to prevent race conditions
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Normalize detail: Pydantic validation errors return detail as array of objects.
    // Convert to a readable string so toast.error() doesn't crash React.
    if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
      const messages = error.response.data.detail
        .map((e: any) => e.msg?.replace(/^Value error, /, '') || e.message || 'Validation error')
        .join('. ');
      error.response.data.detail = messages;
    }

    const originalRequest = error.config;

    if (error.response?.status === 401 && typeof window !== 'undefined' && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the ongoing refresh to complete
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        onRefreshed(data.access_token);
        return api(originalRequest);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
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
  logout: () => api.post('/auth/logout'),
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
  earnings: () => api.get<{ date: string; earnings: number }[]>('/users/me/earnings'),
  // Pool Profiles
  poolProfiles: () => api.get<PoolProfile[]>('/users/me/pool-profiles'),
  createPoolProfile: (data: {
    name: string; algorithm_id?: number; pool_url: string; pool_user: string; pool_password?: string; is_default?: boolean;
    pool2_url?: string; pool2_user?: string; pool2_password?: string;
    pool3_url?: string; pool3_user?: string; pool3_password?: string;
    pool4_url?: string; pool4_user?: string; pool4_password?: string;
    pool5_url?: string; pool5_user?: string; pool5_password?: string;
  }) =>
    api.post<PoolProfile>('/users/me/pool-profiles', data),
  updatePoolProfile: (id: number, data: Partial<{
    name: string; algorithm_id: number; pool_url: string; pool_user: string; pool_password: string; is_default: boolean;
    pool2_url: string; pool2_user: string; pool2_password: string;
    pool3_url: string; pool3_user: string; pool3_password: string;
    pool4_url: string; pool4_user: string; pool4_password: string;
    pool5_url: string; pool5_user: string; pool5_password: string;
  }>) =>
    api.put<PoolProfile>(`/users/me/pool-profiles/${id}`, data),
  deletePoolProfile: (id: number) => api.delete(`/users/me/pool-profiles/${id}`),
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
  algoStats: () => api.get<Record<string, number>>('/rigs/algo-stats'),
  myRigs: () => api.get<Rig[]>('/rigs/my-rigs'),
  get: (id: number) => api.get<Rig>(`/rigs/${id}`),
  hashrateHistory: (id: number, hours?: number) => api.get(`/rigs/${id}/hashrate-history`, { params: { hours } }),
  bulkUpdate: (data: { rig_ids: number[]; price_per_hour?: number; status?: string; min_rental_hours?: number; max_rental_hours?: number }) =>
    api.post('/rigs/bulk-update', data),
  create: (data: any) => api.post<Rig>('/rigs', data),
  update: (id: number, data: any) => api.put<Rig>(`/rigs/${id}`, data),
  delete: (id: number) => api.delete(`/rigs/${id}`),
};

// Rentals
export const rentalsAPI = {
  create: (data: {
    rig_id: number; duration_hours: number;
    pool_url: string; pool_user: string; pool_password?: string;
    pool2_url?: string; pool2_user?: string; pool2_password?: string;
    pool3_url?: string; pool3_user?: string; pool3_password?: string;
    pool4_url?: string; pool4_user?: string; pool4_password?: string;
    pool5_url?: string; pool5_user?: string; pool5_password?: string;
  }) => api.post<Rental>('/rentals', data),
  list: (params?: { role?: string; page?: number; per_page?: number }) =>
    api.get<RentalListResponse>('/rentals', { params }),
  get: (id: number) => api.get<Rental>(`/rentals/${id}`),
  cancel: (id: number) => api.post<Rental>(`/rentals/${id}/cancel`),
  extend: (id: number, hours: number) => api.post(`/rentals/${id}/extend`, { hours }),
  updatePool: (id: number, data: {
    pool_url: string; pool_user: string; pool_password?: string;
    pool2_url?: string; pool2_user?: string; pool2_password?: string;
    pool3_url?: string; pool3_user?: string; pool3_password?: string;
    pool4_url?: string; pool4_user?: string; pool4_password?: string;
    pool5_url?: string; pool5_user?: string; pool5_password?: string;
  }) => api.put(`/rentals/${id}/pool`, data),
  conversations: () => api.get<RentalConversation[]>('/rentals/conversations'),
  getMessages: (id: number) => api.get<RentalMessage[]>(`/rentals/${id}/messages`),
  sendMessage: (id: number, content: string) => api.post<RentalMessage>(`/rentals/${id}/messages`, { content }),
  hashrateStats: (id: number, hours?: number) => api.get(`/rentals/${id}/hashrate-stats`, { params: { hours } }),
  massRent: (data: {
    rig_ids: number[]; duration_hours: number;
    pool_url: string; pool_user: string; pool_password?: string;
    pool2_url?: string; pool2_user?: string; pool2_password?: string;
    pool3_url?: string; pool3_user?: string; pool3_password?: string;
    pool4_url?: string; pool4_user?: string; pool4_password?: string;
    pool5_url?: string; pool5_user?: string; pool5_password?: string;
  }) => api.post('/rentals/mass-rent', data),
  ownerStats: () => api.get('/rentals/owner-stats/me'),
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

// Disputes
export const disputesAPI = {
  list: () => api.get<Dispute[]>('/disputes'),
  get: (id: number) => api.get<Dispute>(`/disputes/${id}`),
  create: (data: { rental_id: number; reason: string }) =>
    api.post('/disputes', data),
  addMessage: (id: number, content: string) =>
    api.post(`/disputes/${id}/message`, { content }),
  resolve: (id: number, data: { resolution: string; action: string; refund_percent?: number }) =>
    api.post(`/disputes/${id}/resolve`, data),
};

// Favorites
export const favoritesAPI = {
  list: () => api.get<{ rig_id: number; created_at: string }[]>('/favorites'),
  add: (rigId: number) => api.post(`/favorites/${rigId}`),
  remove: (rigId: number) => api.delete(`/favorites/${rigId}`),
};

// Messages
export const messagesAPI = {
  conversations: () => api.get<Conversation[]>('/messages/conversations'),
  messages: (otherUserId: number, params?: { before_id?: number; limit?: number }) =>
    api.get<MessageItem[]>(`/messages/${otherUserId}`, { params }),
  send: (data: { receiver_id: number; content: string }) =>
    api.post<MessageItem>('/messages/send', data),
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
  walletBalance: () => api.get<{ ltc_balance: number }>('/admin/wallet-balance'),
  // Disputes
  disputes: (status?: string) => api.get('/admin/disputes', { params: { status } }),
  disputeDetail: (id: number) => api.get(`/admin/disputes/${id}`),
  disputeMessage: (id: number, content: string) => api.post(`/admin/disputes/${id}/message`, { content }),
  resolveDispute: (id: number, data: { action: string; resolution: string; refund_amount?: number }) =>
    api.post(`/admin/disputes/${id}/resolve`, data),
  pendingActions: () => api.get<{ pending_withdrawals: number; pending_disputes: number; pending_escrows: number; open_tickets: number; total: number }>('/admin/pending-actions'),
  // Sprint 2: Granular controls
  overrideRPI: (rigId: number, data: { rpi_score: number; reason: string }) =>
    api.post(`/admin/rigs/${rigId}/rpi-override`, data),
  correctRig: (rigId: number, data: { hashrate?: number; status?: string; reason: string }) =>
    api.post(`/admin/rigs/${rigId}/correct`, data),
  reviewRental: (rentalId: number, data: { action: string; refund_amount?: number; reason?: string }) =>
    api.post(`/admin/rentals/${rentalId}/review`, data),
  // Settings
  settings: () => api.get<PlatformSetting[]>('/admin/settings'),
  updateSetting: (key: string, value: string) =>
    api.put<PlatformSetting>(`/admin/settings/${key}`, { value }),
  // Support tickets (admin)
  supportTickets: (status?: string) => api.get('/support/admin/all', { params: { status } }),
  resolveTicket: (ticketId: number) => api.post(`/support/${ticketId}/resolve`),
  addSupportMessage: (ticketId: number, message: string) => api.post(`/support/${ticketId}/messages`, { message }),
};

// Support Tickets API
export const supportAPI = {
  create: (data: { subject: string; message: string; category?: string; priority?: string; rental_id?: number }) =>
    api.post('/support', data),
  list: (status?: string) => api.get('/support', { params: { status } }),
  get: (ticketId: number) => api.get(`/support/${ticketId}`),
  addMessage: (ticketId: number, message: string) => api.post(`/support/${ticketId}/messages`, { message }),
};

export default api;
