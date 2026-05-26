import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';

/**
 * KnowledgeBaseModule — RAG knowledge base per tenant.
 *
 * Exports KnowledgeBaseService so AIManagerService (infrastructure layer)
 * can import it for context injection without circular dependency:
 *
 *   AiModule → AiService → AIManagerService (imports KnowledgeBaseService)
 *   KnowledgeBaseModule exports KnowledgeBaseService
 *
 * PrismaModule is global (registered in AppModule) — no need to import here.
 */
@Module({
  imports: [ConfigModule],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
