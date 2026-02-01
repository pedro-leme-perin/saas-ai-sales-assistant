const API_URL = 'http://localhost:3001';

export const analyticsService = {
  getDashboard: async () => {
    return {
      totalCalls: 247,
      activeChats: 45,
      aiSuggestions: 189,
      conversionRate: 67,
      callsOverTime: [
        { date: new Date().toISOString(), count: 35 }
      ],
      sentiments: {
        positive: 120,
        neutral: 80,
        negative: 47
      },
      recentActivities: []
    };
  }
};