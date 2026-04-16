# ADR-011: AI provider abstraction with automatic fallback

- **Status:** Aceito
- **Data:** 2026-04-14 (formaliza decisão tomada na sessão 28)
- **Referências:** *Designing ML Systems* — "Model Deployment & Monitoring";
  *Release It!* — Circuit Breaker, Bulkheads; *Clean Architecture* Cap. 22
  (Dependency Inversion); GoF — Strategy pattern.

## Contexto

O produto depende de LLMs para sugestões em tempo real (call latência crítica
< 2s p95). Provedores de LLM têm padrões diferentes de:

- **Disponibilidade**: outages frequentes (OpenAI ~99.5% historical)
- **Latência**: varia 200ms–10s+ por modelo/região
- **Custo**: 10× diferença entre `gpt-4o-mini` e `claude-opus`
- **Qualidade**: cada um é melhor em tasks diferentes
- **Rate limits**: TPM/RPM por API key

Acoplar o código de negócio diretamente a `openai.chat.completions.create`
significa que:

1. Outage do OpenAI = produto quebrado.
2. Trocar de modelo (custo) requer alterar 30+ arquivos.
3. Testar com mock = mockear SDK do OpenAI inteiro.
4. Comparar provedores em produção (A/B test) é impraticável.

## Decisão

**Toda chamada a LLM passa por uma abstração `AIProvider` (interface
abstrata) gerenciada pelo `AIManagerService`.**

### Camada de abstração

```
┌──────────────────────────────────────────────────────┐
│  ApplicationServices (calls.service, whatsapp.service)│
│           usa apenas AIService.generateSuggestion()  │
└────────────────────┬─────────────────────────────────┘
                     │ Strategy pattern (GoF)
┌────────────────────▼─────────────────────────────────┐
│  AIManagerService                                    │
│  - Mantém lista ordenada (fallbackOrder)             │
│  - Tenta preferred → fallback chain                  │
│  - Cada provider tem CircuitBreaker individual       │
└────────────────────┬─────────────────────────────────┘
                     │
   ┌─────────────────┼──────────────────┐
   │                 │                  │
┌──▼──────┐   ┌─────▼─────┐   ┌────────▼──────┐
│ OpenAI  │   │  Claude   │   │   Gemini      │ (etc.)
│Provider │   │ Provider  │   │   Provider    │
└─────────┘   └───────────┘   └───────────────┘
   ↑              ↑                   ↑
   └─ implements `AIProvider` (abstract class)
```

### Contrato canônico

```typescript
abstract class AIProvider {
  abstract generateSuggestion(
    transcript: string,
    context?: Record<string, unknown>,
  ): Promise<AISuggestion>;

  abstract analyzeConversation(
    transcript: string,
    context?: Record<string, unknown>,
  ): Promise<AIAnalysis>;

  abstract healthCheck(): Promise<boolean>;
  getProviderName(): string;
}
```

Retornos sempre incluem `provider`, `latencyMs`, `tokensUsed`, `confidence`
— para observabilidade comparativa.

### Fallback automático

`AIManagerService` mantém ordem de preferência (`fallbackOrder`):

```typescript
fallbackOrder: AIProviderType[] = ['gemini', 'openai', 'claude', 'perplexity'];
```

Lógica:
1. Tenta `preferredProvider` (parâmetro do caller).
2. Se circuit breaker daquele provider está aberto OU chamada falha →
   tenta o próximo na `fallbackOrder`.
3. Se todos falharem → resposta genérica pré-definida (degradação graciosa).

### Circuit breaker por provider

Cada provider tem sua própria instância de `CircuitBreaker`
(`common/resilience/circuit-breaker.ts`). Trip threshold: 3 falhas
consecutivas → OPEN por 30s → HALF_OPEN para teste.

## Consequências

### Positivas

- **Resiliência**: outage de 1 provider não derruba o produto.
- **Vendor neutrality**: trocar OpenAI por Anthropic = mudar `fallbackOrder`.
- **A/B testing**: dois providers podem rodar em paralelo para mesma query
  com sampling.
- **Cost control**: provider mais barato como primary; fallback para o caro.
- **Testability**: mock `AIProvider` em vez de mockear SDKs de 4 vendors.
- **Observability**: cada chamada loga `provider` + `latencyMs` →
  comparação histórica em Axiom.

### Negativas / trade-offs aceitos

- **Complexidade**: 4 providers + manager = ~600 LOC vs ~50 LOC se
  acoplasse direto em OpenAI.
- **Lowest common denominator**: features avançadas (function calling,
  streaming) não são parte da interface — exigem extensão por provider.
- **Compliance**: cada provider tem seus próprios termos (PII handling,
  retention). Hoje todos seguem padrão "no training on customer data" mas
  precisa auditar individualmente.

## Compliance

Code review checklist:

- [ ] Toda chamada a LLM em código de aplicação usa `AIService.generateSuggestion`
      ou `AIService.analyzeConversation` — nunca `OpenAI.chat.completions`
      direto fora de `infrastructure/ai/providers/`.
- [ ] Novo provider implementa `AIProvider` abstract class
      (todos os 3 métodos: generateSuggestion, analyzeConversation, healthCheck).
- [ ] Provider novo é registrado em `AIManagerService.providers` Map e
      adicionado à `fallbackOrder`.
- [ ] Provider novo tem circuit breaker (já automático via `wrapWithCircuitBreaker`
      no AIManager).
- [ ] Nenhum SDK de LLM (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`)
      importado fora de `infrastructure/ai/providers/`.

## Notas

- Streaming responses (token-by-token) não está coberto pela interface
  atual — quando precisar (ex: live transcription suggestions), criar
  `IAIProviderStream` separado para não quebrar consumers.
- Cost tracking por provider requer parsing do `tokensUsed` retorno —
  hoje é só logado; agregação histórica em Axiom (futuro: dashboard de
  custo por modelo).
- LangChain foi avaliado e descartado: adiciona uma camada de abstração
  sobre nossa abstração (overhead de runtime + bundle), e a maioria das
  features é overkill para nosso caso de uso (sem chains complexas, sem
  agents, sem RAG no produto atual).
