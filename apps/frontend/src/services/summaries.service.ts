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
};
