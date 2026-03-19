import { Injectable } from '@nestjs/common';

@Injectable()
export class CacheService {
  private cache = new Map<string, unknown>();

  async get(key: string): Promise<unknown | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    this.cache.set(key, value);
    if (ttl) {
      setTimeout(() => {
        this.cache.delete(key);
      }, ttl * 1000);
    }
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  userKey(userId: string): string {
    return `user:${userId}`;
  }

  callKey(callId: string): string {
    return `call:${callId}`;
  }

  companyKey(companyId: string): string {
    return `company:${companyId}`;
  }

  aiSuggestionKey(callId: string): string {
    return `ai:suggestion:${callId}`;
  }
}
