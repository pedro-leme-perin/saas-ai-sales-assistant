// =============================================
// 📄 REPLY TEMPLATES MODULE (Session 46)
// =============================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReplyTemplatesService } from './reply-templates.service';
import { ReplyTemplatesController } from './reply-templates.controller';

@Module({
  imports: [ConfigModule],
  controllers: [ReplyTemplatesController],
  providers: [ReplyTemplatesService],
  exports: [ReplyTemplatesService],
})
export class ReplyTemplatesModule {}
