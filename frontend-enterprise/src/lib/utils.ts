import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formata duração em segundos para "MM:SS" ou "HH:MM:SS"
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Formata número de telefone brasileiro
export function formatPhone(phone: string): string {
  if (!phone) return '';
  
  // Remove tudo que não é número
  const cleaned = phone.replace(/\D/g, '');
  
  // Formato brasileiro: +55 (11) 99999-9999
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

// Formata data/hora
export function formatDateTime(date: string | Date): string {
  if (!date) return '';
  
  const d = new Date(date);
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// Formata data relativa (há X minutos, etc)
export function formatRelativeTime(date: string | Date): string {
  if (!date) return '';
  
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays}d`;
  
  return formatDateTime(date);
}

// Retorna cor baseada no status da chamada
export function getCallStatusColor(status: string): string {
  const colors: Record<string, string> = {
    INITIATED: 'bg-blue-100 text-blue-800',
    RINGING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    FAILED: 'bg-red-100 text-red-800',
    NO_ANSWER: 'bg-orange-100 text-orange-800',
    BUSY: 'bg-purple-100 text-purple-800',
    CANCELED: 'bg-gray-100 text-gray-600',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// Retorna cor baseada no status do chat
export function getChatStatusColor(status: string): string {
  const colors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    ACTIVE: 'bg-green-100 text-green-800',
    RESOLVED: 'bg-gray-100 text-gray-800',
    ARCHIVED: 'bg-gray-100 text-gray-600',
    BLOCKED: 'bg-red-100 text-red-800',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// Retorna cor baseada na prioridade
export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-800',
    NORMAL: 'bg-blue-100 text-blue-800',
    HIGH: 'bg-orange-100 text-orange-800',
    URGENT: 'bg-red-100 text-red-800',
  };
  
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

// Traduz status para português
export function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    // Call status
    INITIATED: 'Iniciada',
    RINGING: 'Chamando',
    IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluída',
    FAILED: 'Falhou',
    NO_ANSWER: 'Sem Resposta',
    BUSY: 'Ocupado',
    CANCELED: 'Cancelada',
    // Chat status
    OPEN: 'Aberto',
    PENDING: 'Pendente',
    ACTIVE: 'Ativo',
    RESOLVED: 'Resolvido',
    ARCHIVED: 'Arquivado',
    BLOCKED: 'Bloqueado',
    // Direction
    INBOUND: 'Entrada',
    OUTBOUND: 'Saída',
    INCOMING: 'Recebida',
    OUTGOING: 'Enviada',
  };
  
  return translations[status] || status;
}

// Alias para compatibilidade
export const formatRelative = formatRelativeTime;
// Formata valor para moeda brasileira
export function formatCurrency(value: number): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
// Formata data para exibição
export function formatDate(date: string | Date): string {
  if (!date) return '';
  
  const d = new Date(date);
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
   }).format(d);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}