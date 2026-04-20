// =============================================
// 🔔 NOTIFICATION PREFERENCES SERVICE (Session 48)
// =============================================

import apiClient from "@/lib/api-client";

export type NotificationTypeKey =
  | "SYSTEM"
  | "CALL_STARTED"
  | "CALL_ENDED"
  | "NEW_MESSAGE"
  | "AI_SUGGESTION"
  | "SUBSCRIPTION_UPDATE"
  | "BILLING_ALERT"
  | "TEAM_UPDATE";

export type NotificationChannelKey = "IN_APP" | "EMAIL" | "PUSH" | "SMS";

export interface NotificationPreferenceItem {
  id?: string;
  type: NotificationTypeKey;
  channel: NotificationChannelKey;
  enabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  timezone?: string | null;
  digestMode?: boolean;
}

export interface UpsertPreferencesInput {
  items: NotificationPreferenceItem[];
}

export const notificationPreferencesService = {
  list: async () => {
    const res = await apiClient.get<{ data: NotificationPreferenceItem[] }>(
      `/users/me/notification-preferences`,
    );
    return res.data;
  },
  upsert: (input: UpsertPreferencesInput) =>
    apiClient.patch<{ updated: number }>(`/users/me/notification-preferences`, input),
  reset: () => apiClient.delete<{ deleted: number }>(`/users/me/notification-preferences`),
};

export const NOTIFICATION_TYPES: NotificationTypeKey[] = [
  "SYSTEM",
  "CALL_STARTED",
  "CALL_ENDED",
  "NEW_MESSAGE",
  "AI_SUGGESTION",
  "SUBSCRIPTION_UPDATE",
  "BILLING_ALERT",
  "TEAM_UPDATE",
];

export const NOTIFICATION_CHANNELS: NotificationChannelKey[] = ["IN_APP", "EMAIL", "PUSH", "SMS"];
