// src/stores/useAuthStore.ts
import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
  plan: string;
}

interface AuthStore {
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: {
    id: 'user-1',
    name: 'Pedro Perin',
    email: 'pedro@example.com',
    role: 'ADMIN',
    companyId: 'company-1',
  },
  company: {
    id: 'company-1',
    name: 'Empresa Demo',
    plan: 'PROFESSIONAL',
  },
  isAuthenticated: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setCompany: (company) => set({ company }),
  logout: () => set({ user: null, company: null, isAuthenticated: false }),
}));
