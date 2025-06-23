import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Company } from '@/types';
import apiService from '@/services/api';

interface AuthState {
  user: User | null;
  company: Company | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
    companyEmail: string;
    companyPhone?: string;
  }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateUser: (user: User) => void;
  updateCompany: (company: Company) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      company: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await apiService.login(email, password);
          const { user, token, company } = response.data;
          
          apiService.setToken(token);
          
          set({
            user,
            company,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await apiService.register(data);
          const { user, token, company } = response.data;
          
          apiService.setToken(token);
          
          set({
            user,
            company,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        apiService.clearToken();
        set({
          user: null,
          company: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      loadUser: async () => {
        const token = apiService.getToken();
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await apiService.me();
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            user: null,
            company: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          apiService.clearToken();
        }
      },

      updateUser: (user: User) => {
        set({ user });
      },

      updateCompany: (company: Company) => {
        set({ company });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        company: state.company,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);