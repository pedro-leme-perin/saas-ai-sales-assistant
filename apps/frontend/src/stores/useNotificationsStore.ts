// src/stores/useNotificationsStore.ts
import { create } from 'zustand';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

interface NotificationsStore {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  notifications: [
    {
      id: '1',
      title: 'Nova chamada',
      message: 'Você tem uma nova chamada de +5511999999999',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 5),
    },
    {
      id: '2',
      title: 'Sugestão IA gerada',
      message: 'IA sugeriu resposta para objeção do cliente',
      type: 'success',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 15),
    },
  ],
  unreadCount: 2,
  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: Math.random().toString(36).substr(2, 9),
        read: false,
        createdAt: new Date(),
      };
      return {
        notifications: [newNotification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    }),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  clearNotifications: () =>
    set({
      notifications: [],
      unreadCount: 0,
    }),
}));
