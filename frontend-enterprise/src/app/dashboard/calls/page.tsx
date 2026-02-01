'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Filter,
  Plus,
  Sparkles,
  Clock,
  MoreVertical,
  Play,
  Pause,
  Mic,
  MicOff,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { callsService } from '@/services/api';
import { formatDuration, formatDateTime, formatPhone, getCallStatusColor } from '@/lib/utils';
import { CallStatus, CallDirection, type Call } from '@/types';
import { useActiveCallStore, useAISuggestionsStore } from '@/stores';
import { wsClient } from '@/lib/websocket';

export default function CallsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  const { activeCallId, isInCall, callDuration, transcript, setActiveCall, endCall } =
    useActiveCallStore();
  const { currentSuggestion, isGenerating } = useAISuggestionsStore();

  // Fetch calls
  const { data: callsData, isLoading } = useQuery({
    queryKey: ['calls', { status: statusFilter, direction: directionFilter, search: searchQuery }],
    queryFn: () =>
      callsService.getAll({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        direction: directionFilter !== 'all' ? directionFilter : undefined,
        search: searchQuery || undefined,
        limit: 20,
      }),
  });

  // Fetch call stats
  const { data: stats } = useQuery({
    queryKey: ['call-stats'],
    queryFn: () => callsService.getStats(),
  });

  // Start new call mutation
  const startCallMutation = useMutation({
    mutationFn: (phoneNumber: string) =>
      callsService.create({ phoneNumber, direction: 'OUTBOUND' }),
    onSuccess: (call) => {
      setActiveCall(call.id);
      wsClient.joinCall(call.id);
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });

  // End call mutation
  const endCallMutation = useMutation({
    mutationFn: (callId: string) => callsService.complete(callId),
    onSuccess: () => {
      if (activeCallId) {
        wsClient.leaveCall(activeCallId);
      }
      endCall();
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });

  const handleStartCall = () => {
    const phoneNumber = prompt('Digite o número de telefone:');
    if (phoneNumber) {
      startCallMutation.mutate(phoneNumber);
    }
  };

  const handleEndCall = () => {
    if (activeCallId) {
      endCallMutation.mutate(activeCallId);
    }
  };

  const getCallIcon = (call: Call) => {
    if (call.status === 'MISSED') return PhoneMissed;
    return call.direction === 'INBOUND' ? PhoneIncoming : PhoneOutgoing;
  };

  const getCallIconColor = (call: Call) => {
    if (call.status === 'MISSED') return 'text-red-500 bg-red-100';
    return call.direction === 'INBOUND'
      ? 'text-blue-500 bg-blue-100'
      : 'text-green-500 bg-green-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ligações</h1>
          <p className="text-muted-foreground">
            Gerencie suas chamadas e receba sugestões de IA em tempo real.
          </p>
        </div>
        <Button onClick={handleStartCall} disabled={isInCall}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Ligação
        </Button>
      </div>

      {/* Active Call Panel */}
      {isInCall && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Call Info */}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pulse">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Ligação em Andamento</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {formatDuration(callDuration)}
                    </p>
                  </div>
                </div>

                {/* Transcript */}
                <div className="bg-background rounded-lg p-4 max-h-40 overflow-y-auto mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Transcrição ao vivo:</p>
                  {transcript.length > 0 ? (
                    <div className="space-y-2">
                      {transcript.slice(-5).map((entry, idx) => (
                        <p
                          key={idx}
                          className={`text-sm ${
                            entry.speaker === 'customer' ? 'text-blue-600' : 'text-green-600'
                          }`}
                        >
                          <span className="font-medium">
                            {entry.speaker === 'customer' ? 'Cliente: ' : 'Você: '}
                          </span>
                          {entry.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Aguardando transcrição...
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" onClick={handleEndCall}>
                    <Phone className="h-4 w-4 mr-2" />
                    Encerrar
                  </Button>
                </div>
              </div>

              {/* AI Suggestion Panel */}
              <div className="lg:w-80 bg-background rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Sugestão da IA</h4>
                </div>
                {isGenerating ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    Analisando conversa...
                  </div>
                ) : currentSuggestion ? (
                  <div>
                    <p className="text-sm mb-2">{currentSuggestion.suggestion}</p>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          currentSuggestion.type === 'objection'
                            ? 'bg-amber-100 text-amber-700'
                            : currentSuggestion.type === 'closing'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {currentSuggestion.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(currentSuggestion.confidence * 100)}% confiança
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Continue a conversa para receber sugestões personalizadas.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <Phone className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.byStatus?.COMPLETED || 0}
                </p>
              </div>
              <PhoneOutgoing className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Perdidas</p>
                <p className="text-2xl font-bold text-red-600">{stats?.byStatus?.MISSED || 0}</p>
              </div>
              <PhoneMissed className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Duração Média</p>
                <p className="text-2xl font-bold">{formatDuration(stats?.avgDuration || 0)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border rounded-lg bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="COMPLETED">Concluídas</option>
          <option value="MISSED">Perdidas</option>
          <option value="IN_PROGRESS">Em andamento</option>
        </select>
        <select
          className="px-4 py-2 border rounded-lg bg-background"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="all">Todas as direções</option>
          <option value="INBOUND">Recebidas</option>
          <option value="OUTBOUND">Realizadas</option>
        </select>
      </div>

      {/* Calls List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Ligações</CardTitle>
          <CardDescription>
            {callsData?.meta?.total || 0} ligações encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : callsData?.data && callsData.data.length > 0 ? (
            <div className="space-y-2">
              {callsData.data.map((call) => {
                const CallIcon = getCallIcon(call);
                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${getCallIconColor(
                          call
                        )}`}
                      >
                        <CallIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {call.contactName || formatPhone(call.phoneNumber)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(call.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm">{formatDuration(call.duration)}</p>
                        <p className={`text-xs ${getCallStatusColor(call.status)}`}>
                          {call.status === 'COMPLETED'
                            ? 'Concluída'
                            : call.status === 'MISSED'
                            ? 'Perdida'
                            : call.status === 'IN_PROGRESS'
                            ? 'Em andamento'
                            : call.status}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma ligação encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece fazendo sua primeira ligação com assistência de IA.
              </p>
              <Button onClick={handleStartCall}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Ligação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
