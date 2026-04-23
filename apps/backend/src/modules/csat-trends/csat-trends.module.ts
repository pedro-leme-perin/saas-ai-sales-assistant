// =============================================
// 📈 CsatTrendsModule (Session 59 — Feature A2)
// =============================================
// Analytics-only over CsatResponse — no outbound side effects.
// Keeps CSAT core (write path) decoupled from trend queries (read path).

import { Module } from '@nestjs/common';

import { CsatTrendsController } from './csat-trends.controller';
import { CsatTrendsService } from './csat-trends.service';

@Module({
  controllers: [CsatTrendsController],
  providers: [CsatTrendsService],
  exports: [CsatTrendsService],
})
export class CsatTrendsModule {}
