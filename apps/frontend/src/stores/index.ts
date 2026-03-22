import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Company, AISuggestion, Notification } from '@/types';

// =============================================
// USER STORE
// =============================================

interface UserState {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  company: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setCompany: (company) => set({ company }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ user: null, company: null, isLoading: false }),
}));

// =============================================
// AI SUGGESTIONS STORE
// =============================================

interface AISuggestionsState {
  currentSuggestion: AISuggestion | null;
  suggestions: AISuggestion[];
  isGenerating: boolean;
  setCurrentSuggestion: (suggestion: AISuggestion | null) => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  setGenerating: (generating: boolean) => void;
  clearSuggestions: () => void;
}

export const useAISuggestionsStore = create<AISuggestionsState>((set) => ({
  currentSuggestion: null,
  suggestions: [],
  isGenerating: false,
  setCurrentSuggestion: (suggestion) => set({ currentSuggestion: suggestion }),
  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [suggestion, ...state.suggestions].slice(0, 20),
      currentSuggestion: suggestion,
    })),
  setGenerating: (isGenerating) => set({ isGenerating }),
  clearSuggestions: () => set({ currentSuggestion: null, suggestions: [] }),
}));

// =============================================
// NOTIFICATIONS STORE
// =============================================

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setUnreadCount: (count: number) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
}));

// =============================================
// ACTIVE CALL STORE
// =============================================

interface ActiveCallState {
  activeCallId: string | null;
  isInCall: boolean;
  callDuration: number;
  transcript: Array<{ speaker: 'customer' | 'vendor'; text: string; timestamp: Date }>;
  setActiveCall: (callId: string | null) => void;
  setInCall: (inCall: boolean) => void;
  setDuration: (duration: number) => void;
  addTranscriptEntry: (entry: { speaker: 'customer' | 'vendor'; text: string }) => void;
  clearTranscript: () => void;
  endCall: () => void;
}

export const useActiveCallStore = create<ActiveCallState>((set) => ({
  activeCallId: null,
  isInCall: false,
  callDuration: 0,
  transcript: [],
  setActiveCall: (callId) => set({ activeCallId: callId, isInCall: !!callId }),
  setInCall: (isInCall) => set({ isInCall }),
  setDuration: (callDuration) => set({ callDuration }),
  addTranscriptEntry: (entry) =>
    set((state) => ({
      transcript: [...state.transcript, { ...entry, timestamp: new Date() }],
    })),
  clearTranscript: () => set({ transcript: [] }),
  endCall: () =>
    set({
      activeCallId: null,
      isInCall: false,
      callDuration: 0,
      transcript: [],
    }),
}));

// =============================================
// ACTIVE CHAT STORE
// =============================================

interface ActiveChatState {
  activeChatId: string | null;
  isTyping: boolean;
  otherUserTyping: boolean;
  setActiveChat: (chatId: string | null) => void;
  setTyping: (typing: boolean) => void;
  setOtherUserTyping: (typing: boolean) => void;
}

export const useActiveChatStore = create<ActiveChatState>((set) => ({
  activeChatId: null,
  isTyping: false,
  otherUserTyping: false,
  setActiveChat: (chatId) => set({ activeChatId: chatId }),
  setTyping: (isTyping) => set({ isTyping }),
  setOtherUserTyping: (otherUserTyping) => set({ otherUserTyping }),
}));

// =============================================
// UI STORE (Persisted)
// =============================================

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  locale: 'pt-BR' | 'en';
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLocale: (locale: 'pt-BR' | 'en') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',
      locale: 'pt-BR',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'ui-storage',
    }
  )
);
