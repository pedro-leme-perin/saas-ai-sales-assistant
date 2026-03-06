import apiClient from "@/lib/api-client";

const getCompanyId = () => {
  const companyId = apiClient.getCompanyId();
  if (!companyId) throw new Error("CompanyId not set");
  return companyId;
};

export const whatsappService = {
  getChats: async (params?: { search?: string }) => {
    return apiClient.get(`/whatsapp/chats/${getCompanyId()}`, params as Record<string, unknown>);
  },

  getChat: async (chatId: string) => {
    return apiClient.get(`/whatsapp/chats/${getCompanyId()}/${chatId}`);
  },

  getMessages: async (chatId: string) => {
    return apiClient.get(`/whatsapp/chats/${getCompanyId()}/${chatId}/messages`);
  },

  sendMessage: async (chatId: string, data: { content: string; aiSuggestionUsed?: boolean; suggestionId?: string }) => {
    return apiClient.post(`/whatsapp/chats/${getCompanyId()}/${chatId}/messages`, data);
  },

  getSuggestion: async (chatId: string) => {
    return apiClient.get(`/whatsapp/chats/${getCompanyId()}/${chatId}/suggestion`);
  },

  markAsRead: async (chatId: string) => {
    return apiClient.patch(`/whatsapp/chats/${getCompanyId()}/${chatId}/read`, {});
  },
};
