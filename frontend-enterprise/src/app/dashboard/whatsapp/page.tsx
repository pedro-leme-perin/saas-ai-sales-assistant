'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Search, Send, Sparkles, MoreVertical,
  Phone, User, CheckCheck, Smile, Paperclip, ArrowLeft,
  Copy, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { whatsappService, aiService } from '@/services/api';
import { formatRelative, cn } from '@/lib/utils';
import { useActiveChatStore, useAISuggestionsStore, useUserStore } from '@/stores';
import { wsClient } from '@/lib/websocket';
import { toast } from 'sonner';
import type { WhatsAppChat, WhatsAppMessage } from '@/types';
import { useTranslation } from '@/i18n/use-translation';

const SUGGESTION_TYPE_COLORS: Record<string, string> = {
  objection: 'bg-amber-100 text-amber-700',
  closing:   'bg-green-100 text-green-700',
  question:  'bg-blue-100 text-blue-700',
  greeting:  'bg-purple-100 text-purple-700',
  general:   'bg-slate-100 text-slate-700',
};

function ChatListSkeleton() {
  return (
    <div className="divide-y">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-40 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <div className={`rounded-2xl animate-pulse bg-muted ${i % 2 === 0 ? 'w-48 h-12' : 'w-56 h-16'}`} />
        </div>
      ))}
    </div>
  );
}

export default function WhatsAppPage() {
  const { isLoading: authLoading, user } = useUserStore();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSuggestion, setCopiedSuggestion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { setActiveChat, otherUserTyping, setOtherUserTyping } = useActiveChatStore();
  const { currentSuggestion, setCurrentSuggestion, setGenerating } = useAISuggestionsStore();

  // Fetch chats
  const { data: chatsData, isLoading: chatsLoading } = useQuery({
    queryKey: ['whatsapp-chats', searchQuery],
    queryFn: () => whatsappService.getChats({ search: searchQuery || undefined }),
  });

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['whatsapp-messages', selectedChat?.id],
    queryFn: () => whatsappService.getMessages(selectedChat!.id),
    enabled: !!selectedChat,
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; aiSuggestionUsed?: boolean }) =>
      whatsappService.sendMessage(selectedChat!.id, data),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedChat?.id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    },
    onError: (error: any) => {
      toast.error(t('whatsapp.errorSendMessage'), { description: error.message });
    },
  });

  // Get AI suggestion
  const getSuggestionMutation = useMutation({
    mutationFn: () => whatsappService.getSuggestion(selectedChat!.id),
    onSuccess: (suggestion) => {
      setCurrentSuggestion(suggestion);
      setGenerating(false);
    },
    onError: () => {
      setGenerating(false);
      toast.error(t('whatsapp.errorGenerateSuggestion'));
    },
  });

  // WebSocket events
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
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherUserTyping(false), 5000);
        }
      });

      const unsubTypingStop = wsClient.on('typing:stop', (data: any) => {
        if (data.chatId === selectedChat.id) {
          setOtherUserTyping(false);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
      });

      return () => {
        wsClient.leaveChat(selectedChat.id);
        setActiveChat(null);
        unsubMessage();
        unsubTyping();
        unsubTypingStop();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      };
    }
  }, [selectedChat, queryClient, setActiveChat, setOtherUserTyping]);

  // Scroll to bottom
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
    toast.success(t('whatsapp.suggestionSent'));
  };

  const handleCopySuggestion = () => {
    if (!currentSuggestion) return;
    navigator.clipboard.writeText(currentSuggestion.suggestion);
    setCopiedSuggestion(true);
    toast.success(t('whatsapp.suggestionCopied'));
    setTimeout(() => setCopiedSuggestion(false), 2000);
  };

  const handleGetSuggestion = () => {
    if (!selectedChat) return;
    setGenerating(true);
    getSuggestionMutation.mutate();
  };

  return (
    <div className="h-[calc(100dvh-7rem)] sm:h-[calc(100vh-8rem)] flex gap-4">
      {/* Chat List */}
      <Card className={cn('w-full md:w-80 flex-shrink-0 flex flex-col', selectedChat && 'hidden md:flex')}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('whatsapp.conversations')}</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('whatsapp.searchChat')}
              className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {chatsLoading ? (
            <ChatListSkeleton />
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
                      <p className="font-medium truncate text-sm">
                        {chat.customerName || chat.customerPhone}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {chat.lastMessagePreview || t('whatsapp.noMessagesPreview')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm text-muted-foreground">{t('whatsapp.noConversations')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat View */}
      {selectedChat ? (
        <Card className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedChat(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{selectedChat.customerName || selectedChat.customerPhone}</p>
              <p className="text-sm text-muted-foreground">
                {otherUserTyping ? (
                  <span className="text-primary flex items-center gap-1">
                    <span className="flex space-x-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                    </span>
                    {t('whatsapp.typing')}
                  </span>
                ) : (
                  selectedChat.status
                )}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label={t('whatsapp.callLabel')}><Phone className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" aria-label={t('whatsapp.moreOptions')}><MoreVertical className="h-5 w-5" /></Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {messagesLoading ? (
              <MessagesSkeleton />
            ) : messagesData?.data && messagesData.data.length > 0 ? (
              <>
                {messagesData.data.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2 shadow-sm',
                        msg.direction === 'OUTGOING'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-background border rounded-bl-sm'
                      )}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'
                      )}>
                        <span className="text-[10px] opacity-70">{formatRelative(msg.createdAt)}</span>
                        {msg.direction === 'OUTGOING' && <CheckCheck className="h-3 w-3 opacity-70" />}
                        {msg.aiSuggestionUsed && <Sparkles className="h-3 w-3 text-amber-400" />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm text-muted-foreground">{t('whatsapp.noMessages')}</p>
              </div>
            )}
          </div>

          {/* AI Suggestion */}
          {currentSuggestion && (
            <div className="p-3 border-t bg-primary/5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-primary">{t('ai.suggestion')}</p>
                    {currentSuggestion.type && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        SUGGESTION_TYPE_COLORS[currentSuggestion.type] || 'bg-muted'
                      }`}>
                        {t(`ai.tags.${currentSuggestion.type}`) || currentSuggestion.type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{currentSuggestion.suggestion}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCopySuggestion}>
                    {copiedSuggestion ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" onClick={handleUseSuggestion}>{t('ai.send')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCurrentSuggestion(null)}>&#x2715;</Button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label={t('whatsapp.emojisLabel')} className="shrink-0"><Smile className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" aria-label={t('whatsapp.attachFile')} className="shrink-0"><Paperclip className="h-5 w-5" /></Button>
              <input
                type="text"
                placeholder={t('whatsapp.typeMessage')}
                className="flex-1 px-4 py-2 border rounded-full bg-background text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('whatsapp.askAI')}
                className="shrink-0"
                onClick={handleGetSuggestion}
                disabled={getSuggestionMutation.isPending}
              >
                <Sparkles className={cn('h-5 w-5', getSuggestionMutation.isPending ? 'animate-spin' : 'text-primary')} />
              </Button>
              <Button
                size="icon"
                aria-label={t('whatsapp.sendMessage')}
                className="shrink-0"
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
            <MessageSquare className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('whatsapp.selectChat')}</h3>
            <p className="text-sm text-muted-foreground">{t('whatsapp.selectChatHint')}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
