export const callsService = {
  getCalls: async () => {
    return {
      calls: [{
        id: '1',
        userId: 'user-1',
        companyId: 'company-1',
        phoneNumber: '+5511999999999',
        direction: 'INBOUND',
        status: 'COMPLETED',
        duration: 300,
        sentiment: 0.8,
        createdAt: new Date()
      }],
      total: 1,
      limit: 10,
      offset: 0
    };
  }
};