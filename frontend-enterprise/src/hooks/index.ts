import { useEffect, useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wsClient } from '@/lib/websocket';
import { useAISuggestionsStore, useNotificationsStore, useActiveCallStore } from '@/stores';
import type { WSAISuggestion, WSCallStatus, WSNewMessage, WSNotification } from '@/types';

// =============================================
// useWebSocket - WebSocket connection management
// =============================================

export function useWebSocket(userId: string | undefined, companyId: string | undefined) {
  const [isConnected, setIsConnected] = useState(false);
  const { addSuggestion } = useAISuggestionsStore();
  const { addNotification } = useNotificationsStore();

  useEffect(() => {
    if (!userId || !companyId) return;

    wsClient.connect();

    const checkConnection = setInterval(() => {
      setIsConnected(wsClient.isConnected);
    }, 1000);

    // Subscribe to events
    const unsubSuggestion = wsClient.on('ai:suggestion', (data: WSAISuggestion) => {
      addSuggestion(data.suggestion);
    });

    const unsubNotification = wsClient.on('notification', (data: WSNotification) => {
      addNotification(data.notification);
    });

    return () => {
      clearInterval(checkConnection);
      unsubSuggestion();
      unsubNotification();
      wsClient.disconnect();
    };
  }, [userId, companyId, addSuggestion, addNotification]);

  return { isConnected };
}

// =============================================
// useCallWebSocket - Call-specific WebSocket events
// =============================================

export function useCallWebSocket(callId: string | null) {
  const { setActiveCall, setDuration, addTranscriptEntry, endCall } = useActiveCallStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!callId) return;

    wsClient.joinCall(callId);

    const unsubStatus = wsClient.on('call:status', (data: WSCallStatus) => {
      if (data.callId === callId) {
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          endCall();
          queryClient.invalidateQueries({ queryKey: ['calls'] });
        } else if (data.duration) {
          setDuration(data.duration);
        }
      }
    });

    return () => {
      wsClient.leaveCall(callId);
      unsubStatus();
    };
  }, [callId, setActiveCall, setDuration, endCall, queryClient]);
}

// =============================================
// useChatWebSocket - Chat-specific WebSocket events
// =============================================

export function useChatWebSocket(chatId: string | null) {
  const queryClient = useQueryClient();
  const [otherTyping, setOtherTyping] = useState(false);

  useEffect(() => {
    if (!chatId) return;

    wsClient.joinChat(chatId);

    const unsubMessage = wsClient.on('whatsapp:message', (data: WSNewMessage) => {
      if (data.chatId === chatId) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      }
    });

    const unsubTypingStart = wsClient.on('typing:start', (data: any) => {
      if (data.chatId === chatId) {
        setOtherTyping(true);
      }
    });

    const unsubTypingStop = wsClient.on('typing:stop', (data: any) => {
      if (data.chatId === chatId) {
        setOtherTyping(false);
      }
    });

    return () => {
      wsClient.leaveChat(chatId);
      unsubMessage();
      unsubTypingStart();
      unsubTypingStop();
    };
  }, [chatId, queryClient]);

  const startTyping = useCallback(() => {
    if (chatId) wsClient.startTyping(chatId);
  }, [chatId]);

  const stopTyping = useCallback(() => {
    if (chatId) wsClient.stopTyping(chatId);
  }, [chatId]);

  return { otherTyping, startTyping, stopTyping };
}

// =============================================
// useDebounce - Debounce hook
// =============================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// =============================================
// useInterval - Interval hook
// =============================================

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// =============================================
// useCallDuration - Track call duration
// =============================================

export function useCallDuration(isActive: boolean) {
  const [duration, setDuration] = useState(0);

  useInterval(
    () => {
      setDuration((d) => d + 1);
    },
    isActive ? 1000 : null
  );

  useEffect(() => {
    if (!isActive) {
      setDuration(0);
    }
  }, [isActive]);

  return duration;
}

// =============================================
// useLocalStorage - Local storage hook
// =============================================

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}

// =============================================
// useOnClickOutside - Click outside hook
// =============================================

export function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// =============================================
// useMediaQuery - Media query hook
// =============================================

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

// =============================================
// useCopyToClipboard - Copy to clipboard hook
// =============================================

export function useCopyToClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = useCallback(async (text: string) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      return true;
    } catch {
      console.warn('Copy failed');
      setCopiedText(null);
      return false;
    }
  }, []);

  return { copiedText, copy };
}
