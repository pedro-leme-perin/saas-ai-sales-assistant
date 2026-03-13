'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Search, Mail, Phone, Shield, ShieldCheck,
  User, Trash2, Edit, UserPlus, X, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usersService, companiesService } from '@/services/api';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { User as UserType, UserRole } from '@/types';

const roleLabels: Record<UserRole, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  VENDOR: 'Vendedor',
};

const roleColors: Record<UserRole, string> = {
  OWNER: 'bg-purple-100 text-purple-700 border-purple-200',
  ADMIN: 'bg-blue-100 text-blue-700 border-blue-200',
  MANAGER: 'bg-green-100 text-green-700 border-green-200',
  VENDOR: 'bg-slate-100 text-slate-700 border-slate-200',
};

function TeamSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg border animate-pulse">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-muted rounded" />
            <div className="h-3 w-56 bg-muted rounded" />
          </div>
          <div className="h-8 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<UserType | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('VENDOR');
  const emailInputRef = useRef<HTMLInputElement>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll({ limit: 50 }),
  });

  const { data: usage } = useQuery({
    queryKey: ['company-usage'],
    queryFn: () => companiesService.getUsage(),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => usersService.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowDeleteConfirm(null);
      toast.success('Membro removido da equipe.');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover membro', { description: error.message });
    },
  });

  useEffect(() => {
    if (showInviteModal) {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, [showInviteModal]);

  const filteredUsers = usersData?.data?.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteUser = (user: UserType) => {
    if (user.role === 'OWNER') {
      toast.error('Não é possível remover o proprietário da conta.');
      return;
    }
    setShowDeleteConfirm(user);
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    toast.success('Convite enviado!', { description: `Email enviado para ${inviteEmail}` });
    setInviteEmail('');
    setInviteRole('VENDOR');
    setShowInviteModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground">Gerencie os membros da sua equipe de vendas.</p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar Membro
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
                <p className="text-2xl font-bold">{usersData?.meta?.total || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Limite do Plano</p>
                <p className="text-2xl font-bold">{usage?.users?.limit || 0}</p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Administradores</p>
                <p className="text-2xl font-bold">
                  {usersData?.data?.filter((u) => u.role === 'ADMIN' || u.role === 'OWNER').length || 0}
                </p>
              </div>
              <ShieldCheck className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendedores</p>
                <p className="text-2xl font-bold">
                  {usersData?.data?.filter((u) => u.role === 'VENDOR').length || 0}
                </p>
              </div>
              <User className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Bar */}
      {usage && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Uso de Usuários</span>
              <span className="text-sm text-muted-foreground">
                {usage.users.used} de {usage.users.limit} ({usage.users.percentage}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usage.users.percentage > 80 ? 'bg-red-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(usage.users.percentage, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>{filteredUsers?.length || 0} membros encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TeamSkeleton />
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{user.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${roleColors[user.role]}`}>
                          {roleLabels[user.role]}
                        </span>
                        {!user.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                            Inativo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1 hidden sm:flex">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatDateTime(user.createdAt).split(',')[0]}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteUser(user)}
                      disabled={user.role === 'OWNER'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum membro encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? 'Nenhum resultado para sua busca.' : 'Comece convidando membros.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowInviteModal(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Convidar Membro
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* =============================================
          MODAL: Convidar Membro
          ============================================= */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl w-full max-w-md m-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Convidar Membro</h2>
                  <p className="text-sm text-muted-foreground">Envie um convite por email</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowInviteModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <input
                  ref={emailInputRef}
                  type="email"
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2.5 border rounded-lg bg-background text-sm"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Função</label>
                <select
                  className="w-full px-4 py-2.5 border rounded-lg bg-background text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="VENDOR">Vendedor</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowInviteModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1 gap-2" onClick={handleInvite} disabled={!inviteEmail.trim()}>
                  <Mail className="h-4 w-4" />
                  Enviar Convite
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================
          MODAL: Confirmar Exclusão
          ============================================= */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl w-full max-w-sm m-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Remover membro</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Tem certeza que deseja remover <strong>{showDeleteConfirm.name}</strong> da equipe? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => deleteUserMutation.mutate(showDeleteConfirm.id)}
                  disabled={deleteUserMutation.isPending}
                >
                  {deleteUserMutation.isPending ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    'Remover'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
