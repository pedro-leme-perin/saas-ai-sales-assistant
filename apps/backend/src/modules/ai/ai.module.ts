import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AIManagerService, KNOWLEDGE_BASE_SERVICE } from '@/infrastructure/ai/ai-manager.service';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

@Module({
  imports: [ConfigModule, KnowledgeBaseModule],
  controllers: [AiController],
  providers: [
    AiService,
    AIManagerService,
    // Wire KnowledgeBaseService under the injection token used by AIManagerService.
    // AIManagerService uses @Inject(KNOWLEDGE_BASE_SERVICE) + `import type` only,
    // avoiding a circular import between infrastructure/ and modules/.
    {
      provide: KNOWLEDGE_BASE_SERVICE,
      useExisting: KnowledgeBaseService,
    },
  ],
  exports: [AiService, AIManagerService],
})
export class AiModule {}
