import apiClient from "@/lib/api-client";

export type SentimentPoint = "positive" | "neutral" | "negative";

export interface SummarySentimentTick {
  position: number;
  sentiment: SentimentPoint;
  note?: string;
}

export interface ConversationSummary {
  keyPoints: string[];
  sentimentTimeline: SummarySentimentTick[];
  nextBestAction: string;
  generatedAt: string;
  cached: boolean;
  provider: string;
}

export const summariesService = {
  summarizeCall: async (callId: string) =>
    apiClient.post<ConversationSummary>(`/summaries/calls/${callId}`, {}),

  summarizeChat: async (chatId: string) =>
    apiClient.post<ConversationSummary>(`/summaries/chats/${chatId}`, {}),

  // Session 45 — Read persisted auto-summary (no LLM cost). Returns null on 404.
  getPersistedCallSummary: async (
    callId: string,
  ): Promise<ConversationSummary | null> => {
    try {
      return await apiClient.get<ConversationSummary>(`/summaries/calls/${callId}`);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return null;
      throw err;
    }
  },
};
