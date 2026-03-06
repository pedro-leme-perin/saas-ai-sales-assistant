'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import {
  Phone, MessageSquare, Sparkles, TrendingUp, TrendingDown,
  PhoneMissed, Clock, Users, ArrowRight, Activity,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { callsService, companiesService, analyticsService } from '@/services/api';
import { formatDuration, formatDateTime, formatPhone, getCallStatusColor } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useUser();

  const { data: callStats } = useQuery({
    queryKey: ['call-stats'],
    queryFn: () => callsService.getStats(),
  });

  const { data: recentCalls } = useQuery({
    queryKey: ['calls-recent'],
    queryFn: () => callsService.getAll({ limit: 5 }),
  });

  const { data: usage } = useQuery({
    queryKey: ['company-usage'],
    queryFn: () => companiesService.getUsage(),
  });

  const { data: dashboardRaw } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsService.getDashboard(),
  });

  const dashboard = dashboardRaw as any;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {user?.firstName || 'Usuário'} 👋
        </h1>
        <p className="text-muted-foreground">Aqui está o resumo da sua equipe de vendas hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Ligações</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callStats?.total || 0}</div>
            {(dashboard?.calls?.growth ?? 0) >= 0 ? (
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />+{dashboard?.calls?.growth ?? 0}% este mês
              </div>
            ) : (
              <div className="flex items-center text-xs text-red-500 mt-1">
                <TrendingDown className="h-3 w-3 mr-1" />{dashboard?.calls?.growth ?? 0}% este mês
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chats WhatsApp</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.chats?.total || 0}</div>
            {(dashboard?.chats?.growth ?? 0) >= 0 ? (
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />+{dashboard?.chats?.growth ?? 0}% este mês
              </div>
            ) : (
              <div className="flex items-center text-xs text-red-500 mt-1">
                <TrendingDown className="h-3 w-3 mr-1" />{dashboard?.chats?.growth ?? 0}% este mês
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ligações Perdidas</CardTitle>
            <PhoneMissed className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{callStats?.byStatus?.MISSED || 0}</div>
            <div className="flex items-center text-xs text-red-600 mt-1">
              <TrendingDown className="h-3 w-3 mr-1" />Requer atenção
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duração Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(callStats?.avgDuration || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <Activity className="h-3 w-3 mr-1" />Por ligação
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Assistente IA</CardTitle>
            </div>
            <CardDescription>Performance do assistente em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-primary">{dashboard?.ai?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Sugestões geradas</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{dashboard?.ai?.adoptionRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Taxa de uso</p>
              </div>
            </div>
            <Link href="/dashboard/analytics">
              <Button variant="outline" className="w-full" size="sm">
                Ver Analytics<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso do Plano</CardTitle>
            <CardDescription>Plano {usage?.plan || 'Starter'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Usuários</span>
                <span className="text-muted-foreground">{usage?.users?.used || 0} / {usage?.users?.limit || 0}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${usage?.users?.percentage || 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Ligações</span>
                <span className="text-muted-foreground">{usage?.calls?.used || 0} / {usage?.calls?.limit || 0}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${usage?.calls?.percentage || 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Chats</span>
                <span className="text-muted-foreground">{usage?.chats?.used || 0} / {usage?.chats?.limit || 0}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${usage?.chats?.percentage || 0}%` }} />
              </div>
            </div>
            <Link href="/dashboard/billing">
              <Button variant="outline" className="w-full" size="sm">
                Gerenciar Plano<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
            <CardDescription>Atalhos para as principais funcionalidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/calls">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Phone className="mr-2 h-4 w-4 text-blue-500" />Nova Ligação com IA
              </Button>
            </Link>
            <Link href="/dashboard/whatsapp">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <MessageSquare className="mr-2 h-4 w-4 text-green-500" />Abrir WhatsApp
              </Button>
            </Link>
            <Link href="/dashboard/analytics">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <TrendingUp className="mr-2 h-4 w-4 text-purple-500" />Ver Relatórios
              </Button>
            </Link>
            <Link href="/dashboard/team">
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Users className="mr-2 h-4 w-4 text-orange-500" />Gerenciar Equipe
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ligações Recentes</CardTitle>
            <CardDescription>Últimas 5 ligações da sua equipe</CardDescription>
          </div>
          <Link href="/dashboard/calls">
            <Button variant="outline" size="sm">Ver todas<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentCalls?.data && recentCalls.data.length > 0 ? (
            <div className="space-y-2">
              {recentCalls.data.map((call: any) => (
                <div key={call.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{call.contactName || formatPhone(call.phoneNumber)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(call.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatDuration(call.duration)}</p>
                    <p className={`text-xs ${getCallStatusColor(call.status)}`}>
                      {call.status === 'COMPLETED' ? 'Concluída' : call.status === 'MISSED' ? 'Perdida' : 'Em andamento'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma ligação ainda.</p>
              <Link href="/dashboard/calls" className="mt-3">
                <Button size="sm">Fazer primeira ligação</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
