'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  User,
  Building,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  Save,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { companiesService } from '@/services/api';
import { useUIStore } from '@/stores';

type Tab = 'profile' | 'company' | 'notifications' | 'security' | 'appearance';

export default function SettingsPage() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { theme, setTheme } = useUIStore();

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companiesService.getCurrent(),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: (data: any) => companiesService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  const tabs = [
    { id: 'profile' as Tab, label: 'Perfil', icon: User },
    { id: 'company' as Tab, label: 'Empresa', icon: Building },
    { id: 'notifications' as Tab, label: 'Notificações', icon: Bell },
    { id: 'security' as Tab, label: 'Segurança', icon: Shield },
    { id: 'appearance' as Tab, label: 'Aparência', icon: Palette },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e configurações da conta.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <Card className="lg:w-64 flex-shrink-0">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>Atualize suas informações pessoais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Nome</label>
                    <input
                      type="text"
                      defaultValue={user?.firstName || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Sobrenome</label>
                    <input
                      type="text"
                      defaultValue={user?.lastName || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Email</label>
                    <input
                      type="email"
                      defaultValue={user?.primaryEmailAddress?.emailAddress || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Para alterar o email, acesse as configurações do Clerk.
                    </p>
                  </div>
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>Configure os dados da sua empresa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Nome da Empresa</label>
                    <input
                      type="text"
                      defaultValue={company?.name || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Slug</label>
                    <input
                      type="text"
                      defaultValue={company?.slug || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Website</label>
                    <input
                      type="url"
                      defaultValue={company?.website || ''}
                      placeholder="https://exemplo.com"
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Indústria</label>
                    <select
                      defaultValue={company?.industry || ''}
                      className="w-full mt-1 px-4 py-2 border rounded-lg bg-background"
                    >
                      <option value="">Selecione...</option>
                      <option value="technology">Tecnologia</option>
                      <option value="retail">Varejo</option>
                      <option value="services">Serviços</option>
                      <option value="healthcare">Saúde</option>
                      <option value="finance">Finanças</option>
                      <option value="education">Educação</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>
                </div>
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>Configure como você quer ser notificado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    id: 'email_calls',
                    title: 'Ligações perdidas',
                    description: 'Receber email quando perder uma ligação',
                  },
                  {
                    id: 'email_messages',
                    title: 'Novas mensagens',
                    description: 'Receber email para novas mensagens no WhatsApp',
                  },
                  {
                    id: 'push_suggestions',
                    title: 'Sugestões da IA',
                    description: 'Notificações push para sugestões em tempo real',
                  },
                  {
                    id: 'email_reports',
                    title: 'Relatórios semanais',
                    description: 'Receber resumo semanal por email',
                  },
                  {
                    id: 'email_billing',
                    title: 'Atualizações de faturamento',
                    description: 'Notificações sobre cobranças e pagamentos',
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Autenticação</CardTitle>
                  <CardDescription>Configure opções de segurança da sua conta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Autenticação em Duas Etapas</p>
                        <p className="text-sm text-muted-foreground">
                          Adicione uma camada extra de segurança
                        </p>
                      </div>
                    </div>
                    <Button variant="outline">Configurar</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Sessões Ativas</p>
                        <p className="text-sm text-muted-foreground">
                          Gerencie dispositivos conectados
                        </p>
                      </div>
                    </div>
                    <Button variant="outline">Ver Sessões</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Chaves de API</CardTitle>
                  <CardDescription>
                    Gerencie chaves de API para integrações externas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div>
                      <p className="font-mono text-sm">sk_live_••••••••••••••••</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Criada em 01/01/2026
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Regenerar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>Aparência</CardTitle>
                <CardDescription>Personalize a aparência do aplicativo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">Tema</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Claro', icon: Sun },
                      { id: 'dark', label: 'Escuro', icon: Moon },
                      { id: 'system', label: 'Sistema', icon: Monitor },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id as 'light' | 'dark' | 'system')}
                        className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors ${
                          theme === t.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <t.icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">Idioma</label>
                  <select className="w-full px-4 py-2 border rounded-lg bg-background">
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es">Español</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">Fuso Horário</label>
                  <select className="w-full px-4 py-2 border rounded-lg bg-background">
                    <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                    <option value="America/New_York">Nova York (GMT-5)</option>
                    <option value="Europe/London">Londres (GMT+0)</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
