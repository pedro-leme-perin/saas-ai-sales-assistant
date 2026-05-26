import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeChunkDto } from './dto/create-knowledge-chunk.dto';
import { UpdateKnowledgeChunkDto } from './dto/update-knowledge-chunk.dto';
import { QueryKnowledgeBaseDto, SemanticSearchDto } from './dto/query-knowledge-base.dto';
import { TenantGuard } from '@/modules/auth/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser, Roles } from '@/common/decorators';

// Knowledge base mutations (ingest, delete) are restricted to ADMIN+.
// Semantic search is available to all authenticated users (VENDOR+ can use RAG).
@ApiTags('knowledge-base')
@ApiBearerAuth('JWT')
@UseGuards(TenantGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  // ==========================================
  // INGEST — ADMIN+ only
  // ==========================================

  @Post('chunks')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ strict: { ttl: 60000, limit: 20 } }) // embedding calls are expensive
  @ApiOperation({
    summary: 'Ingest a single knowledge chunk',
    description:
      'Embeds and stores a single text chunk in the company knowledge base. ' +
      'Idempotent: duplicate content (same SHA-256 hash) returns the existing chunk.',
  })
  @ApiResponse({ status: 201, description: 'Chunk created or updated' })
  async ingestChunk(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateKnowledgeChunkDto,
  ) {
    return this.knowledgeBaseService.ingestChunk(user.companyId, dto);
  }

  @Post('chunks/batch')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ strict: { ttl: 60000, limit: 5 } }) // batch calls consume many tokens
  @ApiOperation({
    summary: 'Ingest multiple knowledge chunks (batch)',
    description:
      'Embeds and stores up to 100 chunks in a single API call using batch embeddings. ' +
      'Returns created/skipped/error counts. Skipped = duplicate contentHash.',
  })
  @ApiResponse({ status: 201, description: 'Batch ingestion result' })
  async ingestBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { chunks: CreateKnowledgeChunkDto[] },
  ) {
    return this.knowledgeBaseService.ingestBatch(user.companyId, body.chunks);
  }

  // ==========================================
  // SEMANTIC SEARCH
  // ==========================================

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @Throttle({ strict: { ttl: 60000, limit: 30 } })
  @ApiOperation({
    summary: 'Semantic search over the knowledge base',
    description:
      'Embeds the query and returns the top-k most similar chunks via cosine distance. ' +
      'Available to all authenticated users. Used internally by RAG pipeline.',
  })
  @ApiResponse({ status: 200, description: 'Relevant chunks ranked by similarity score' })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SemanticSearchDto,
  ) {
    const chunks = await this.knowledgeBaseService.findRelevant(
      user.companyId,
      dto.query,
      dto.topK,
      dto.minScore,
      dto.source,
    );

    return {
      results: chunks,
      total: chunks.length,
      query: dto.query,
    };
  }

  // ==========================================
  // LIST / READ
  // ==========================================

  @Get('chunks')
  @ApiOperation({
    summary: 'List knowledge chunks',
    description:
      'Paginated list of all chunks in the company knowledge base. ' +
      'Supports filtering by source, sourceRef, and active status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated chunk list' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryKnowledgeBaseDto,
  ) {
    return this.knowledgeBaseService.findAll(user.companyId, query);
  }

  @Get('chunks/:id')
  @ApiOperation({ summary: 'Get a single knowledge chunk by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Chunk found' })
  @ApiResponse({ status: 404, description: 'Chunk not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeBaseService.findOne(user.companyId, id);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Knowledge base statistics',
    description: 'Returns active chunk count and capacity usage for the company.',
  })
  @ApiResponse({ status: 200, description: 'Stats returned' })
  async stats(@CurrentUser() user: AuthenticatedUser) {
    const activeCount = await this.knowledgeBaseService.countActive(user.companyId);
    return {
      activeChunks: activeCount,
      maxChunks: 10_000,
      utilizationPct: Number(((activeCount / 10_000) * 100).toFixed(1)),
    };
  }

  // ==========================================
  // UPDATE / DELETE — ADMIN+ only
  // ==========================================

  @Patch('chunks/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ strict: { ttl: 60000, limit: 20 } })
  @ApiOperation({
    summary: 'Update a knowledge chunk',
    description:
      'Updates chunk metadata, sourceRef, or content. ' +
      'If content changes, re-embeds automatically.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Chunk updated' })
  @ApiResponse({ status: 404, description: 'Chunk not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeChunkDto,
  ) {
    return this.knowledgeBaseService.update(user.companyId, id, dto);
  }

  @Delete('chunks/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a knowledge chunk',
    description:
      'Marks the chunk as deleted and inactive. ' +
      'It will no longer appear in RAG retrieval. Hard purge via RetentionPolicy cron.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Chunk deleted' })
  @ApiResponse({ status: 404, description: 'Chunk not found' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeBaseService.remove(user.companyId, id);
  }

  @Delete('source/:sourceRef')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete all chunks for a source reference',
    description:
      'Soft-deletes all chunks with the given sourceRef within the company. ' +
      'Useful for removing an entire document before re-ingesting an updated version.',
  })
  @ApiParam({ name: 'sourceRef', type: 'string' })
  @ApiResponse({ status: 200, description: 'Deletion count returned' })
  async removeBySourceRef(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sourceRef') sourceRef: string,
  ) {
    const count = await this.knowledgeBaseService.removeBySourceRef(
      user.companyId,
      decodeURIComponent(sourceRef),
    );
    return { deleted: count };
  }
}
