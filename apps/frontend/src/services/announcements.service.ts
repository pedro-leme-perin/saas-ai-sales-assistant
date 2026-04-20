// =============================================
// 📢 ANNOUNCEMENTS SERVICE (Session 53)
// =============================================

import apiClient from "@/lib/api-client";

export type AnnouncementLevel = "INFO" | "WARNING" | "URGENT";
export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "VENDOR";

export interface Announcement {
  id: string;
  companyId: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  publishAt: string;
  expireAt: string | null;
  targetRoles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface ActiveAnnouncement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  publishAt: string;
  expireAt: string | null;
  targetRoles: UserRole[];
  isRead: boolean;
  isDismissed: boolean;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  level?: AnnouncementLevel;
  publishAt?: string;
  expireAt?: string;
  targetRoles?: UserRole[];
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  level?: AnnouncementLevel;
  publishAt?: string;
  expireAt?: string;
  targetRoles?: UserRole[];
}

export const announcementsService = {
  list: async () => {
    const res = await apiClient.get<{ data: Announcement[] }>(`/announcements`);
    return res.data ?? (res as unknown as Announcement[]);
  },
  listActive: async () => {
    const res = await apiClient.get<{ data: ActiveAnnouncement[] }>(
      `/announcements/active`,
    );
    return res.data ?? (res as unknown as ActiveAnnouncement[]);
  },
  findById: (id: string) => apiClient.get<Announcement>(`/announcements/${id}`),
  create: (dto: CreateAnnouncementInput) =>
    apiClient.post<Announcement>(`/announcements`, dto),
  update: (id: string, dto: UpdateAnnouncementInput) =>
    apiClient.patch<Announcement>(`/announcements/${id}`, dto),
  remove: (id: string) =>
    apiClient.delete<{ success: true }>(`/announcements/${id}`),
  markRead: (id: string) =>
    apiClient.post<{ success: true }>(`/announcements/${id}/read`),
  dismiss: (id: string) =>
    apiClient.post<{ success: true }>(`/announcements/${id}/dismiss`),
};
