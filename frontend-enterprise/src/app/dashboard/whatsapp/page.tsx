'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Search,
  Send,
  Sparkles,
  MoreVertical,
  Phone,
  User,
  Clock,
  CheckCheck,
  Image as ImageIcon,
  Paperclip,
  Smile,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { whatsappService, aiService } from '@/services/api';
import { formatRelative, cn } from '@/lib/utils';
import { useActiveChatStore, useAISuggestionsStore } from '@/stores';
import { wsClient } from '@/lib/websocket';
import type { WhatsAppChat, WhatsAppMessage } from '@/types';

export default function WhatsAppPage() {
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { setActiveChat, otherUserTyping, setOtherUserTyping } = useActiveChatStore();
  const { currentSuggestion, setCurrentSuggestion, setGenerating } = useAISuggestionsStore();

  // Fetch chats
  const { data: chatsData, isLoading: chatsLoading } = useQuery({
    queryKey: ['whatsapp-chats', searchQuery],
    queryFn: () => whatsappService.getChats({ search: searchQuery || undefined }),
  });

  // Fetch messages for selected chat
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['whatsapp-messages', selectedChat?.id],
    queryFn: () => whatsappService.getMessages(selectedChat!.id),
    enabled: !!selectedChat,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; aiSuggestionUsed?: boolean }) =>
      whatsappService.sendMessage(selectedChat!.id, data),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedChat?.id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
  });

  // Get AI suggestion mutation
  const getSuggestionMutation = useMutation({
    mutationFn: () => whatsappService.getSuggestion(selectedChat!.id),
    onSuccess: (suggestion) => {
      setCurrentSuggestion(suggestion);
    },
  });

  // Subscribe to WebSocket events
  useEffect(() => {
    if (selectedChat) {
      wsClient.joinChat(selectedChat.id);
      setActiveChat(selectedChat.id);

      const unsubMessage = wsClient.on('whatsapp:message', (data: any) => {
        if (data.chatId === selectedChat.id) {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedChat.id] });
        }
      });

      const unsubTyping = wsClient.on('typing:start', (data: any) => {
        if (data.chatId === selectedChat.id) {
          setOtherUserTyping(true);
        }
      });

      const unsubTypingStop = wsClient.on('typing:stop', (data: any) => {
        if (data.chatId === selectedChat.id) {
          setOtherUserTyping(false);
        }
      });

      return () => {
        wsClient.leaveChat(selectedChat.id);
        setActiveChat(null);
        unsubMessage();
        unsubTyping();
        unsubTypingStop();
      };
    }
  }, [selectedChat, queryClient, setActiveChat, setOtherUserTyping]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  const handleSend = () => {
    if (!message.trim() || !selectedChat) return;
    sendMessageMutation.mutate({ content: message.trim() });
  };

  const handleUseSuggestion = () => {
    if (!currentSuggestion || !selectedChat) return;
    sendMessageMutation.mutate({
      content: currentSuggestion.suggestion,
      aiSuggestionUsed: true,
    });
    setCurrentSuggestion(null);
  };

  const handleGetSuggestion = () => {
    if (!selectedChat) return;
    setGenerating(true);
    getSuggestionMutation.mutate();
    setGenerating(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Chat List */}
      <Card
        className={cn(
          'w-full md:w-80 flex-shrink-0 flex flex-col',
          selectedChat && 'hidden md:flex'
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Conversas</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar conversa..."
              className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {chatsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : chatsData?.data && chatsData.data.length > 0 ? (
            <div className="divide-y">
              {chatsData.data.map((chat) => (
                <button
                  key={chat.id}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left',
                    selectedChat?.id === chat.id && 'bg-muted'
                  )}
                  onClick={() => setSelectedChat(chat)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">
                        {chat.customerName || chat.customerPhone}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.lastMessagePreview || 'Sem mensagens'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat View */}
      {selectedChat ? (
        <Card className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSelectedChat(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {selectedChat.customerName || selectedChat.customerPhone}
              </p>
              <p className="text-sm text-muted-foreground">
                {otherUserTyping ? (
                  <span className="text-primary">Digitando...</span>
                ) : (
                  selectedChat.status
                )}
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : messagesData?.data && messagesData.data.length > 0 ? (
              <>
                {messagesData.data.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2',
                        msg.direction === 'OUTGOING'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-background border rounded-bl-sm'
                      )}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <div
                        className={cn(
                          'flex items-center gap-1 mt-1',
                          msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <span className="text-xs opacity-70">
                          {formatRelative(msg.createdAt)}
                        </span>
                        {msg.direction === 'OUTGOING' && (
                          <CheckCheck className="h-3 w-3 opacity-70" />
                        )}
                        {msg.aiSuggestionUsed && (
                          <Sparkles className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma mensagem ainda. Inicie a conversa!
                </p>
              </div>
            )}
          </div>

          {/* AI Suggestion */}
          {currentSuggestion && (
            <div className="p-3 border-t bg-primary/5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary mb-1">Sugestão da IA</p>
                  <p className="text-sm">{currentSuggestion.suggestion}</p>
                </div>
                <Button size="sm" onClick={handleUseSuggestion}>
                  Usar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCurrentSuggestion(null)}>
                  ✕
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Smile className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Paperclip className="h-5 w-5" />
              </Button>
              <input
                type="text"
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2 border rounded-full bg-background"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGetSuggestion}
                disabled={getSuggestionMutation.isPending}
              >
                <Sparkles className="h-5 w-5 text-primary" />
              </Button>
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!message.trim() || sendMessageMutation.isPending}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground">
              Escolha um chat da lista para começar a conversar
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
