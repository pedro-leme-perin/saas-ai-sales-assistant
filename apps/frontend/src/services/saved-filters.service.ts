// =============================================
// 💾 SAVED FILTERS SERVICE (Session 48)
// =============================================

import apiClient from "@/lib/api-client";

export type FilterResource = "CALL" | "CHAT";

export interface SavedFilterJson {
  q?: string;
  tagIds?: string[];
  sentiment?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
  minDuration?: number;
  maxDuration?: number;
  direction?: string;
}

export interface SavedFilter {
  id: string;
  companyId: string;
  userId: string | null;
  name: string;
  resource: FilterResource;
  filterJson: SavedFilterJson;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedFilterInput {
  name: string;
  resource: FilterResource;
  filterJson: SavedFilterJson;
  isPinned?: boolean;
  shared?: boolean;
}

export type UpdateSavedFilterInput = Partial<
  Pick<CreateSavedFilterInput, "name" | "filterJson" | "isPinned">
>;

export const savedFiltersService = {
  list: async (resource?: FilterResource) => {
    const qs = resource ? `?resource=${resource}` : "";
    const res = await apiClient.get<{ data: SavedFilter[] }>(`/saved-filters${qs}`);
    return res.data;
  },

  findById: (id: string) => apiClient.get<SavedFilter>(`/saved-filters/${id}`),

  create: (input: CreateSavedFilterInput) =>
    apiClient.post<SavedFilter>(`/saved-filters`, input),

  update: (id: string, input: UpdateSavedFilterInput) =>
    apiClient.patch<SavedFilter>(`/saved-filters/${id}`, input),

  togglePin: (id: string) => apiClient.post<SavedFilter>(`/saved-filters/${id}/pin`, {}),

  remove: (id: string) => apiClient.delete<{ success: true }>(`/saved-filters/${id}`),
};
