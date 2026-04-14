import { create } from 'zustand';
import { authApi } from '../api/client';
import useBrandStore from './brandStore';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),

  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
    // Force brand refetch for the newly logged-in user
    useBrandStore.getState().clearBrand();
  },

  logout: async () => {
    const user = get().user;
    try {
      if (user?.role === 'master') await authApi.masterLogout();
      else if (user?.role === 'admin') await authApi.adminLogout();
      else await authApi.customerLogout();
    } catch { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
    // Clear brand so the next user gets their own brand
    useBrandStore.getState().clearBrand();
  },

  updateUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
}));

export default useAuthStore;
