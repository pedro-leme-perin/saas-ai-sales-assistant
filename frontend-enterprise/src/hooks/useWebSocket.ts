'use client';

import { useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { wsClient } from '@/lib/websocket';
import { useNotificationsStore } from '@/stores/useNotificationsStore';

/**
 * Hook that manages WebSocket connection lifecycle
 * Connects using Clerk userId + companyId from session
 * Automatically subscribes to all backend events
 */
export function useWebSocket(companyId?: string) {
  const { userId, isSignedIn } = useAuth();
  const { addNotification } = useNotificationsStore();

  const connect = useCallback(() => {
    if (!isSignedIn || !userId || !companyId) return;
    wsClient.connect(userId, companyId);
  }, [isSignedIn, userId, companyId]);

  useEffect(() => {
    if (!isSignedIn || !userId || !companyId) return;

    // Connect WebSocket
    connect();

    // Subscribe to notifications from backend
    const unsubNotification = wsClient.onNotification((notification) => {
      addNotification({
        title: notification.title || 'Nova notificação',
        message: notification.message || '',
        type: notification.type || 'info',
      });
    });

    // Subscribe to AI suggestions (adds as notification)
    const unsubAI = wsClient.onAISuggestion((suggestion) => {
      addNotification({
        title: '💡 Sugestão IA',
        message: suggestion.text || suggestion.message || '',
        type: 'success',
      });
    });

    // Cleanup on unmount
    return () => {
      unsubNotification();
      unsubAI();
    };
  }, [isSignedIn, userId, companyId, connect, addNotification]);

  return {
    isConnected: wsClient.isConnected(),
    joinCall: (callId: string) => wsClient.joinCall(callId),
    joinChat: (chatId: string) => wsClient.joinChat(chatId),
    onAISuggestion: wsClient.onAISuggestion.bind(wsClient),
    onCallStatusUpdate: wsClient.onCallStatusUpdate.bind(wsClient),
    onWhatsAppMessage: wsClient.onWhatsAppMessage.bind(wsClient),
  };
}