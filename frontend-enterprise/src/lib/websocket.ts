import { io, Socket } from 'socket.io-client';

class WebSocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(token?: string) {
    if (this.socket?.connected) return;

    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket error:', error.message);
    });

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

    // Retorna função de unsubscribe
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

  joinRoom(room: string) {
    this.emit('join-room', { room });
  }

  leaveRoom(room: string) {
    this.emit('leave-room', { room });
  }

  joinCall(callId: string) {
    this.emit('join-call', { callId });
  }

  leaveCall(callId: string) {
    this.emit('leave-call', { callId });
  }

  joinChat(chatId: string) {
    this.emit('join-chat', { chatId });
  }

  leaveChat(chatId: string) {
    this.emit('leave-chat', { chatId });
  }

  onAISuggestion(callback: (suggestion: any) => void) {
    return this.on('ai-suggestion', callback);
  }

  onCallUpdate(callback: (call: any) => void) {
    return this.on('call-update', callback);
  }

  onNewMessage(callback: (message: any) => void) {
    return this.on('new-message', callback);
  }
}

export const wsClient = new WebSocketClient();
startTyping(chatId: string) {
    this.emit('typing:start', { chatId });
  }

  stopTyping(chatId: string) {
    this.emit('typing:stop', { chatId });
  }
export const websocketService = wsClient;