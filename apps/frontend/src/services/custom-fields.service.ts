// =============================================
// 🧩 CUSTOM FIELDS SERVICE (Session 55 — Feature A1)
// =============================================

import apiClient from "@/lib/api-client";

export type CustomFieldResource = "CONTACT";
export type CustomFieldType = "TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "SELECT";

export interface CustomFieldDefinition {
  id: string;
  companyId: string;
  resource: CustomFieldResource;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomFieldInput {
  resource: CustomFieldResource;
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  options?: string[];
  isActive?: boolean;
  displayOrder?: number;
}

export type UpdateCustomFieldInput = Partial<
  Omit<CreateCustomFieldInput, "resource" | "key" | "type">
>;

export const customFieldsService = {
  list: async (resource?: CustomFieldResource) => {
    const res = await apiClient.get<{ data: CustomFieldDefinition[] }>(
      `/custom-fields${resource ? `?resource=${resource}` : ""}`,
    );
    return res.data ?? (res as unknown as CustomFieldDefinition[]);
  },
  findById: (id: string) =>
    apiClient.get<CustomFieldDefinition>(`/custom-fields/${id}`),
  create: (dto: CreateCustomFieldInput) =>
    apiClient.post<CustomFieldDefinition>(`/custom-fields`, dto),
  update: (id: string, dto: UpdateCustomFieldInput) =>
    apiClient.patch<CustomFieldDefinition>(`/custom-fields/${id}`, dto),
  remove: (id: string) =>
    apiClient.delete<{ success: true }>(`/custom-fields/${id}`),
};
