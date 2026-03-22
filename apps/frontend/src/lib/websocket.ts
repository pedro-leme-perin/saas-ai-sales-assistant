import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

class WebSocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(userId?: string, companyId?: string) {
    if (this.socket?.connected) return;

    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    this.socket = io(`${url}/ws`, {
      transports: ['websocket', 'polling'],
      // ✅ Backend expects userId and companyId, not token
      auth: userId && companyId ? { userId, companyId } : {},
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      // Dismiss any previous disconnection toast
      toast.dismiss('ws-disconnected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      if (reason !== 'io client disconnect') {
        toast.warning('Conexão perdida', {
          description: 'Reconectando automaticamente...',
          id: 'ws-disconnected',
          duration: Infinity,
        });
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket error:', error.message);
      toast.error('Erro de conexão em tempo real', {
        description: 'Sugestões de IA podem estar indisponíveis.',
        id: 'ws-error',
        duration: 5000,
      });
    });

    this.socket.io.on('reconnect', (attempt) => {
      console.log(`✅ WebSocket reconnected after ${attempt} attempts`);
      toast.success('Conexão restaurada', {
        id: 'ws-reconnected',
        duration: 3000,
      });
    });

    this.socket.io.on('reconnect_failed', () => {
      toast.error('Falha na reconexão', {
        description: 'Recarregue a página para tentar novamente.',
        id: 'ws-reconnect-failed',
        duration: Infinity,
      });
    });

    // Re-register existing listeners on reconnect
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event, callback as any);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }

    return () => {
      this.off(event, callback);
    };
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // =====================================================
  // ROOM MANAGEMENT
  // =====================================================

  joinCall(callId: string) {
    this.emit('join:call', { callId });
  }

  leaveCall(callId: string) {
    this.emit('leave:call', { callId });
  }

  leaveChat(chatId: string) {
    this.emit('leave:chat', { chatId });
  }

  joinChat(chatId: string) {
    this.emit('join:chat', { chatId });
  }

  // =====================================================
  // EVENT LISTENERS - Matching backend event names
  // =====================================================

  // Backend emits: 'ai:suggestion'
  onAISuggestion(callback: (suggestion: any) => void) {
    return this.on('ai:suggestion', callback);
  }

  // Backend emits: 'call:status'
  onCallStatusUpdate(callback: (call: any) => void) {
    return this.on('call:status', callback);
  }

  // Backend emits: 'whatsapp:message'
  onWhatsAppMessage(callback: (message: any) => void) {
    return this.on('whatsapp:message', callback);
  }

  // Backend emits: 'notification'
  onNotification(callback: (notification: any) => void) {
    return this.on('notification', callback);
  }

  // =====================================================
  // TYPING INDICATORS
  // =====================================================

  startTyping(chatId: string) {
    this.emit('typing:start', { chatId });
  }

  stopTyping(chatId: string) {
    this.emit('typing:stop', { chatId });
  }
}

export const wsClient = new WebSocketClient();
export const websocketService = wsClient;
