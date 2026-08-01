// =============================================
// 🧪 E2E TEST - HEALTH ENDPOINT
// =============================================
// Sobe o AppModule inteiro contra um Postgres real e exercita GET /health.
//
// Rodado por `pnpm test:e2e` (test/jest-e2e.json, testRegex `.e2e-spec.ts$`).
// A config principal do jest usa `.*\.spec\.ts$` e NAO casa com `-spec.ts` — isso
// e proposital: `pnpm test` nao deve tentar subir o app inteiro. Ate S85 nenhum
// passo do CI invocava `test:e2e`, e por isso este arquivo nunca tinha rodado.
//
// Sobre o `status` esperado
// -------------------------
// A versao original exigia `status === 'ok'`, o que e inalcancavel aqui. `checkRedis()`
// le `redisAdapterStatus.connected`, que so vira `true` dentro de
// `RedisIoAdapter.connectToRedis()` — chamado por `main.ts`, nunca por
// `createNestApplication()`. Sem esse passo de bootstrap o adapter fica `in-memory`
// e o endpoint reporta `degraded` por definicao, com ou sem Redis no ambiente.
//
// O contrato que vale a pena travar aqui e outro, e esta escrito no proprio
// controller: Postgres em falha e `unhealthy`, Redis em falha e `degraded`, e
// **degradacao nao muda o codigo HTTP** — /health e o healthcheck de deploy da
// Railway, e queda de Redis nao pode bloquear deploy. E isso que os testes abaixo
// verificam.

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

const KNOWN_STATUSES = ['ok', 'degraded', 'unhealthy'] as const;

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('/health (GET) responde 200 com o envelope de status', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toHaveProperty('status');
    expect(KNOWN_STATUSES).toContain(res.body.status);
    expect(res.body).toHaveProperty('timestamp');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body).toHaveProperty('services.database');
    expect(res.body).toHaveProperty('services.redis');
  });

  // O que este e2e existe para provar: que ha um Postgres do outro lado e que a
  // query de liveness passa. E a unica asercao aqui que um unit test nao cobre.
  it('reporta o banco como ok quando ha Postgres atras', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.services.database).toEqual({ status: 'ok' });
    expect(res.body.status).not.toBe('unhealthy');
  });

  // Invariante deliberado, documentado em health.controller.ts: sem Redis o servico
  // degrada mas continua servindo, e o healthcheck de deploy NAO pode ver erro.
  it('degradacao de Redis nao vira erro HTTP', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    if (res.body.services.redis.status !== 'ok') {
      expect(res.body.status).toBe('degraded');
      expect(res.status).toBe(200);
    }
  });

  it('/health devolve JSON', () => {
    return request(app.getHttpServer()).get('/health').expect('Content-Type', /json/).expect(200);
  });
});
