import { create } from 'zustand';
import type { User } from '@/types';
import { authAPI, usersAPI } from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, totp_code?: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password, totp_code) => {
    const { data } = await authAPI.login({ email, password, totp_code });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    // Signal other tabs that auth changed
    localStorage.setItem('auth_event', Date.now().toString());
    const { data: user } = await usersAPI.me();
    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (email, username, password) => {
    await authAPI.register({ email, username, password });
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore errors during logout (token may already be expired)
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.setItem('auth_event', Date.now().toString());
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  fetchUser: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await usersAPI.me();
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user }),
}));

// Cross-tab sync: when another tab logs in/out, refresh this tab's user
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth_event') {
      useAuthStore.getState().fetchUser();
    }
  });
}
