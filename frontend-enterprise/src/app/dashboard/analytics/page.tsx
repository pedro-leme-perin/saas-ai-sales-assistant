'use client';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Phone, MessageSquare,
  Clock, Sparkles, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { analyticsService } from '@/services/api';
import { formatDuration } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data: dashboardRaw, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsService.getDashboard(),
  });

  const { data: callsData } = useQuery({
    queryKey: ['analytics-calls'],
    queryFn: () => analyticsService.getCalls() as Promise<any>,
  });

  const { data: waData } = useQuery({
    queryKey: ['analytics-whatsapp'],
    queryFn: () => analyticsService.getWhatsApp() as Promise<any>,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  const kpis = [
    {
      title: 'Total de Ligações',
      value: dashboard?.calls?.total ?? 0,
      sub: `${dashboard?.calls?.thisMonth ?? 0} este mês`,
      growth: dashboard?.calls?.growth ?? 0,
      icon: Phone,
    },
    {
      title: 'Chats WhatsApp',
      value: dashboard?.chats?.total ?? 0,
      sub: `${dashboard?.chats?.thisMonth ?? 0} este mês`,
      growth: dashboard?.chats?.growth ?? 0,
      icon: MessageSquare,
    },
    {
      title: 'Duração Média',
      value: formatDuration(dashboard?.calls?.avgDuration ?? 0),
      sub: 'por ligação',
      growth: null,
      icon: Clock,
    },
    {
      title: 'Usuários',
      value: dashboard?.users?.total ?? 0,
      sub: 'na equipe',
      growth: null,
      icon: Users,
    },
    {
      title: 'Sugestões IA',
      value: dashboard?.ai?.total ?? 0,
      sub: `${dashboard?.ai?.used ?? 0} utilizadas`,
      growth: null,
      icon: Sparkles,
    },
    {
      title: 'Taxa de Adoção IA',
      value: `${dashboard?.ai?.adoptionRate ?? 0}%`,
      sub: 'sugestões aceitas',
      growth: null,
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Desempenho da equipe de vendas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {kpi.growth !== null ? (
                  kpi.growth >= 0 ? (
                    <span className="flex items-center text-xs text-green-600">
                      <TrendingUp className="h-3 w-3 mr-1" />+{kpi.growth}% vs mês anterior
                    </span>
                  ) : (
                    <span className="flex items-center text-xs text-red-500">
                      <TrendingDown className="h-3 w-3 mr-1" />{kpi.growth}% vs mês anterior
                    </span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">{kpi.sub}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ligações (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{callsData?.total ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Concluídas</span>
              <span className="font-medium">{callsData?.completed ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa de sucesso</span>
              <span className="font-medium">{callsData?.successRate ?? 0}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Duração média</span>
              <span className="font-medium">{formatDuration(callsData?.avgDuration ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Novos chats</span>
              <span className="font-medium">{waData?.totalChats ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Chats abertos</span>
              <span className="font-medium">{waData?.openChats ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mensagens trocadas</span>
              <span className="font-medium">{waData?.messages ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

