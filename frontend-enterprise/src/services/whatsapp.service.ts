export const whatsappService = {
  getChats: async () => {
    return {
      chats: [{
        id: '1',
        userId: 'user-1',
        companyId: 'company-1',
        customerName: 'João Silva',
        customerPhone: '+5511999999999',
        status: 'ACTIVE',
        lastMessage: 'Olá!',
        lastMessageAt: new Date(),
        unreadCount: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      total: 1,
      limit: 10,
      offset: 0
    };
  }
};