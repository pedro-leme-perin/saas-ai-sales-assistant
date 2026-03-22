// src/components/dashboard/ActivityFeed.tsx
// Fundamento: Clean Code - Separation of Concerns
// Responsabilidade: Feed de atividades recentes do sistema

'use client';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  MessageSquare,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Activity {
  id: string;
  type: 'call' | 'message' | 'user' | 'success' | 'alert' | 'ai';
  title: string;
  description: string;
  timestamp: Date;
  userName?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const activityIcons = {
  call: Phone,
  message: MessageSquare,
  user: UserPlus,
  success: CheckCircle,
  alert: AlertCircle,
  ai: Sparkles,
};

const activityColors = {
  call: 'bg-blue-100 text-blue-600',
  message: 'bg-green-100 text-green-600',
  user: 'bg-purple-100 text-purple-600',
  success: 'bg-emerald-100 text-emerald-600',
  alert: 'bg-yellow-100 text-yellow-600',
  ai: 'bg-pink-100 text-pink-600',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Atividades Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Nenhuma atividade recente
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, index) => {
                const Icon = activityIcons[activity.type];
                const colorClass = activityColors[activity.type];

                return (
                  <div
                    key={activity.id}
                    className="flex gap-3"
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {activity.description}
                          </p>
                          {activity.userName && (
                            <p className="mt-1 text-xs text-gray-400">
                              por {activity.userName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
