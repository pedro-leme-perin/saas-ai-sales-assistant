# Roadmap até o lançamento — TheIAdvisor

**Criado:** 2026-07-31 (S84) · **Base:** auditoria de 46 módulos backend, 41 telas frontend, 92 suítes de teste, infraestrutura em 6 provedores
**Estado na criação:** 62/100 · CI verde · produção estável e monitorada · zero clientes

---

## Como este documento funciona

Organizado em **portões de liberação** (_gates_), não em lista plana. Um portão só
abre quando todos os seus itens têm critério de aceite satisfeito. Isso evita o
erro clássico de lançar com 90% de cada área e 0% de nenhuma.

Cada item tem:

| Campo         | Significado                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| **Dono**      | `Pedro` (só ele pode fazer) · `Claude Code` (repositório) · `Cowork` (painel)  |
| **Bloqueia**  | O que não pode avançar enquanto isto não fechar                                |
| **Aceite**    | Critério **verificável**. Não vale "achei que estava ok"                       |
| **Verificar** | Comando ou ação concreta que prova o aceite                                    |
| **Latência**  | Tempo de espera por terceiros (≠ esforço)                                      |
| **Sev**       | 🔴 bloqueia lançamento · 🟠 bloqueia cliente pagante · 🟡 dívida · ⚪ melhoria |

**Regra de ouro deste projeto (lição #57 + #63):** um item só é marcado como
concluído depois de **executar com sucesso ao menos uma vez em produção**.
Código escrito, configuração declarada e documentação atualizada não contam.

---

## Caminho crítico

Os três itens que destravam tudo. Nenhum é código. Todos dependem do CNPJ
67.084.607/0001-78, que já existe.

```
G2-01 Stripe Identity PJ ──────┐  (1-3 dias úteis de análise)
                                ├──→ receber pagamento
G1-01 Verificação Meta ─────────┼──→ canal WhatsApp operacional
      (CNPJ)                    │    (1-5 dias úteis de análise)
                                │
G1-02 Número Twilio BR ─────────┴──→ canal telefone operacional
      (compra imediata)              │
                                     ↓
                          G3 → primeiro usuário real
```

**Iniciar G2-01 e G1-01 no mesmo dia.** Ambos são análise de terceiro; rodam em
paralelo e a espera é o custo dominante. G1-02 é compra instantânea — pode ficar
por último sem penalidade.

---

# GATE 0 — Fundação operacional

**Status: ✅ FECHADO em 2026-07-31 (S84)**

Registrado para rastreabilidade e para que uma sessão futura não refaça.

| ID    | Item                              | Aceite                                               | Estado                    |
| ----- | --------------------------------- | ---------------------------------------------------- | ------------------------- |
| G0-01 | Zerar advisories HIGH bloqueantes | `blocking=0` no job Security                         | ✅ 19 → 0                 |
| G0-02 | Correções chegarem a produção     | `uptime` do processo reiniciado após o deploy        | ✅ Watch Paths corrigido  |
| G0-03 | Monitoramento externo             | Alerta de DOWN recebido por e-mail em incidente real | ✅ 3 monitores            |
| G0-04 | Healthcheck de deploy             | Deploy quebrado não sobe                             | ✅ `/health` na Railway   |
| G0-05 | Teto de gasto                     | Limite configurado no provedor principal             | ✅ $50 corte / $10 alerta |
| G0-06 | Backup funcionando                | Ao menos um backup concluído com sucesso             | ✅ desde 2026-07-31       |
| G0-07 | Observabilidade de degradação     | Dependência caída vira 503 verificável               | ✅ `/health/deps`         |
| G0-08 | SPF + DMARC                       | Resolvem em consulta DNS pública                     | ✅ ativos                 |

---

# GATE 1 — Produto funcional ponta a ponta

> **Objetivo:** um usuário consegue fazer aquilo que o produto promete.
> **Hoje o produto não funciona para ninguém** — o código dos dois canais está
> pronto e testado, mas nenhum está conectado ao mundo real.

### G1-01 · WhatsApp Business API 🔴

- **Dono:** Pedro · **Latência:** 1–5 dias úteis (análise da Meta)
- **Bloqueia:** canal WhatsApp inteiro, G3-01, lançamento
- **Passos:** Meta Business Manager → verificar empresa com CNPJ → criar app
  WhatsApp Business → obter `Phone Number ID` e `Access Token` permanente →
  configurar webhook apontando para `https://api.theiadvisor.com/api/whatsapp/webhook`
- **Aceite:** mensagem enviada de um celular real chega no dashboard e a IA
  devolve sugestão
- **Verificar:** enviar mensagem para o número e observar o registro em
  `/dashboard/whatsapp`
- **Nota:** o `WHATSAPP_VERIFY_TOKEN` você escolhe; os outros a Meta fornece.
  Nunca colar valor no chat — aplicar direto no painel da Railway.

### G1-02 · Número Twilio BR 🔴

- **Dono:** Pedro · **Latência:** imediata (é compra)
- **Bloqueia:** canal telefone, transcrição, coaching em ligação
- **Passos:** comprar número +55 no console Twilio → configurar webhook de voz
  para `https://api.theiadvisor.com/api/calls/webhook` → preencher
  `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` na Railway
- **Aceite:** ligação real transcrita e visível em `/dashboard/calls`
- **Custo:** número BR ~US$ 1–2/mês + uso por minuto

### G1-03 · Smoke E2E dos dois canais 🔴

- **Dono:** Pedro executa, Cowork acompanha · **Depende de:** G1-01, G1-02
- **Aceite:** roteiro completo executado com sucesso: **(a)** ligação recebida →
  transcrita → sugestão da IA aparece; **(b)** mensagem WhatsApp → resposta
  sugerida → envio; **(c)** ambas registradas em Analytics
- **Por que importa:** teste unitário não pega falha de integração entre
  componentes (lição #26)

### G1-04 · Remover mock órfão ⚪

- **Dono:** Claude Code · **Esforço:** 2 min
- **Item:** `apps/frontend/src/services/analytics.service.ts` não é importado por
  ninguém — o dashboard usa o serviço real de `api.ts`
- **Aceite:** arquivo removido, `pnpm build` do frontend passa

---

# GATE 2 — Capacidade comercial

> **Objetivo:** você pode cobrar e emitir nota fiscal legalmente.

### G2-01 · Stripe Identity verification PJ 🔴

- **Dono:** Pedro · **Latência:** 1–3 dias úteis · **INICIAR PRIMEIRO**
- **Bloqueia:** G2-02, G2-03, G2-04 — e portanto toda receita
- **Documentos:** CNPJ 67.084.607/0001-78 · contrato social · RG · comprovante de
  endereço PJ
- **Aceite:** conta `acct_1TgU9WRpJ3I7SP8K` aparece como verificada e habilitada
  para LIVE no painel
- **Runbook:** `docs/operations/s83/STRIPE_NEW_ACCOUNT_MIGRATION.md` (Fase 2)

### G2-02 · Stripe 2FA com redundância 🔴

- **Dono:** Pedro · **Esforço:** 15 min
- **Contexto:** a conta Stripe **anterior foi perdida em definitivo** por ter só
  passkey, sem backup codes, e o Support negou a recuperação (lição #45). Não
  repetir.
- **Aceite:** passkey **e** TOTP **e** 10 backup codes guardados em 2 locais
  distintos, um deles offline

### G2-03 · Stripe LIVE mode 🔴

- **Dono:** Cowork · **Depende de:** G2-01
- **Passos:** recriar 3 products + 3 prices + webhook de 6 eventos com `--live` →
  atualizar as 6 variáveis na Railway → atualizar `CLAUDE.md` §2.3
- **Aceite:** `STRIPE_SECRET_KEY` começa com `sk_live_` e o webhook aparece como
  ativo no painel
- **Armadilha (lição #50):** na CLI use `-d "chave=valor"`; `--metadata[k]=v` e
  `--description` não existem e falham em silêncio

### G2-04 · Checkout real ponta a ponta 🔴

- **Dono:** Pedro · **Depende de:** G2-03
- **Aceite:** uma assinatura real comprada com cartão real, registro criado em
  `Subscription` no banco, webhook processado, acesso liberado ao plano
- **Nota:** pode ser você mesmo comprando o plano mais barato e cancelando

### G2-05 · Payout Inter PJ 🟠

- **Dono:** Pedro · **Depende de:** G2-01
- **Aceite:** transferência de teste da Stripe cai na conta Inter PJ

### G2-06 · NFS-e operacional 🟠

- **Dono:** Pedro + contador
- **Passos:** sincronização ISSnetOnline (login em até 24h pós-CCM) → configurar
  emissão com o contador
- **Aceite:** uma NFS-e de teste emitida com sucesso
- **Risco se ignorado:** cobrar sem emitir nota é irregularidade fiscal

### G2-07 · Integralizar capital social ⚪

- **Dono:** Pedro · R$ 1.000 via PIX PF→PJ. Diferível até 12 meses. Sem risco em
  pré-lançamento.

---

# GATE 3 — Prontidão para cliente real

> **Objetivo:** você pode guardar dado de terceiro com responsabilidade.
> **Nenhum item deste portão é opcional antes do primeiro cliente pagante.**

### G3-01 · Rotação de credenciais expostas 🟠

- **Dono:** Pedro · **Esforço:** 30 min
- **Contexto:** o token do R2 (escopo: bucket de backups) e o usuário
  `neondb_owner` (escopo: **total sobre o banco de produção**) trafegaram por
  captura de tela em sessão anterior. O risco foi aceito e registrado em
  `CLAUDE.md` §4.3 com gatilho explícito: **antes do primeiro cliente pagante**
- **Aceite:** credenciais novas geradas, antigas revogadas, backup noturno
  executando com sucesso com as novas
- **Verificar:** aguardar um ciclo de backup e conferir o objeto novo no R2
- **Por que é sério:** com dado de cliente no banco, credencial vazada deixa de
  ser risco técnico e vira incidente de LGPD com dever de notificação

### G3-02 · Teste de restore do backup 🟠

- **Dono:** Claude Code + Pedro
- **Contexto:** o backup roda toda noite desde 31/07, mas **nunca foi
  restaurado**. Backup não restaurado é hipótese, não garantia (A8)
- **Aceite:** dump restaurado em branch descartável da Neon, contagem de linhas
  conferida contra produção, branch apagada
- **Meta:** RTO medido e registrado. Hoje o RPO é 6h (PITR da Neon); o RTO é
  desconhecido

### G3-03 · Contas de infraestrutura sob e-mail institucional 🟠

- **Dono:** Pedro · **Esforço:** 30 min
- **Contexto:** Railway, Cloudflare e Upstash estão sob `leme.baseapr@gmail.com`.
  **É a única causa raiz do incidente de junho que continua de pé** — o aviso de
  expiração do trial foi para uma caixa que não é canal operacional
- **Aceite:** as três contas com `pedro.perin@theiadvisor.com` como proprietário
  ou administrador, e um alerta de teste recebido nessa caixa

### G3-04 · 2FA com redundância em todas as contas 🟠

- **Dono:** Pedro
- **Escopo:** Railway, Cloudflare, Neon, Upstash, GitHub, Google Workspace, Stripe
- **Aceite:** cada conta com ao menos 2 fatores e backup codes guardados
- **Precedente:** a conta Stripe perdida custou ~1h de retrabalho **porque não
  havia cliente ainda**. Com clientes, o mesmo evento é indisponibilidade de
  cobrança

### G3-05 · Alertas de billing nos provedores restantes 🟠

- **Dono:** Cowork
- **Escopo:** Cloudflare, Neon, Upstash (Railway ✅ feito em S84)
- **Aceite:** alerta configurado e e-mail de teste recebido em cada um
- **Lição #53:** alerta não testado é alerta inexistente

### G3-06 · Revisão de conformidade LGPD 🟠

- **Dono:** Pedro (idealmente com apoio jurídico)
- **Escopo:** política de privacidade publicada · base legal do tratamento ·
  fluxo DSAR testado (o módulo existe) · política de retenção ativa · encarregado
  designado (`dpo@theiadvisor.com` já existe)
- **Aceite:** solicitação DSAR de teste executada ponta a ponta

### G3-07 · Corrigir OTel sem trace 🟡

- **Dono:** Claude Code
- **Achado em S84:** todo request loga `"traceId": "00000000000000000000000000000000"`.
  Trace zerado = spans não estão sendo registrados
- **Impacto:** durante um incidente, você não consegue seguir uma requisição
  pelo sistema — exatamente quando mais precisa
- **Aceite:** `traceId` não-zero nos logs e trace visível no Axiom

---

# GATE 4 — Escala e confiabilidade

> **Objetivo:** o sistema aguenta crescimento e você sabe qual é o limite.
> Pode abrir **depois** do primeiro cliente, mas antes do décimo.

### G4-01 · Provisionar staging 🟡

- **Dono:** Pedro (credenciais) + Cowork
- **Bloqueia:** G4-02, G4-03, e a remoção de 2 das 4 entradas da allowlist
- **Escopo:** projeto Railway staging · branch Neon staging · Redis Upstash
  staging · bucket R2 staging · 6 secrets no GitHub Actions
- **Runbook:** `docs/operations/s61/STAGING_SETUP_RUNBOOK.md`
- **Aceite:** workflow `staging.yml` executa verde ponta a ponta
- **Pendente desde S61.** Atenção: o smoke desse workflow estava quebrado por
  construção e só foi corrigido em S84 — nunca rodou

### G4-02 · Teste de carga 🟡

- **Dono:** Claude Code · **Depende de:** G4-01
- **Escopo:** 1000 usuários simultâneos + 40 VU sustentados em `/api/ai/suggestion`
- **Aceite:** p95 dentro do SLO, sem erro 5xx, circuit breakers não abertos
- **Nunca rodar contra produção compartilhada**

### G4-03 · Migração OpenTelemetry 2.x 🟡

- **Dono:** Claude Code · **Depende de:** G4-01
- **Ganho:** remove 2 das 4 entradas da allowlist de segurança (ADR-014 e a de
  `propagator-jaeger` no ADR-015)
- **Aceite:** `tsc --noEmit` limpo, traces chegando ao Axiom, allowlist reduzida

### G4-04 · Definir e instrumentar SLO ⚪

- **Dono:** Claude Code + Pedro
- **Contexto:** hoje existe monitoramento de disponibilidade, mas nenhum objetivo
  declarado. Sem SLO não há critério objetivo para decidir entre lançar
  funcionalidade nova e estabilizar
- **Proposta inicial:** disponibilidade 99,5%/mês (~3,6h de orçamento de erro) ·
  p95 da API < 800ms · p95 da sugestão de IA < 3s
- **Aceite:** SLO registrado em ADR e mensurável nos dados que já existem

---

# GATE 5 — Qualidade sustentada

> **Objetivo:** o projeto não acumula dívida mais rápido do que a paga.
> Roda em paralelo aos outros portões. Não bloqueia lançamento.

| ID    | Item                                                                  | Dono        | Aceite                                         |
| ----- | --------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| G5-01 | Triar 16 PRs do Dependabot (abertos desde 28/04)                      | Claude Code | Nenhum PR com mais de 30 dias em aberto        |
| G5-02 | Cobertura 77/66/75/77 → 80% (meta da §9)                              | Claude Code | `coverageThreshold` elevado com CI verde       |
| G5-03 | Commitar spec do `api-key.guard` (486 linhas já escritas)             | Claude Code | Spec no repositório, cobertura de guards > 75% |
| G5-04 | Vulnerabilidades médias `qs` e `uuid`                                 | Claude Code | 1 override por commit (lição #17)              |
| G5-05 | Bundle 2,90 MB → ≤ 2 MB                                               | Claude Code | `pnpm run analyze` abaixo do limiar de aviso   |
| G5-06 | Revisar allowlist de segurança a cada sessão que toque em dependência | Claude Code | Gatilhos do ADR-015 reavaliados                |

---

# Definição de "pronto para lançar"

O produto está pronto quando **todas** as afirmações abaixo forem verdadeiras e
tiverem sido **verificadas em produção**, não presumidas:

1. Uma ligação real é recebida, transcrita, e a IA sugere resposta — G1
2. Uma mensagem de WhatsApp real é recebida e respondida com apoio da IA — G1
3. Um cartão real compra uma assinatura e libera acesso — G2
4. Uma NFS-e é emitida para essa cobrança — G2
5. As credenciais em uso hoje foram rotacionadas depois da última exposição — G3
6. O backup foi restaurado ao menos uma vez com sucesso — G3
7. Se qualquer um dos itens acima quebrar às 3h da manhã, chega alerta — G0 ✅

**Portões mínimos para lançar: G0 ✅ · G1 · G2 · G3.**
G4 e G5 podem correr depois, com clientes em produção.

---

# Primeira semana com cliente real

Checklist que só faz sentido depois do lançamento. Registrado agora para não ser
improvisado depois.

- [ ] Verificar `/health/deps` diariamente na primeira semana
- [ ] Conferir o backup noturno todo dia (não só assumir que rodou)
- [ ] Acompanhar erros no Sentry com atenção redobrada
- [ ] Medir custo real por cliente (IA + Twilio + WhatsApp) e comparar com o preço
- [ ] Registrar toda fricção relatada — é o insumo mais valioso do produto
- [ ] Fazer um postmortem de qualquer incidente, por menor que seja

---

# Riscos conhecidos e aceitos

| Risco                                             | Impacto | Mitigação atual                          | Gatilho de revisão                       |
| ------------------------------------------------- | ------- | ---------------------------------------- | ---------------------------------------- |
| Credenciais expostas não rotacionadas             | Alto    | Nenhuma                                  | **Antes do 1º cliente pagante** (G3-01)  |
| Backup nunca restaurado                           | Alto    | PITR de 6h da Neon                       | G3-02                                    |
| Monitor externo checa de um único ponto (Ashburn) | Baixo   | —                                        | Se houver alarme falso por rota regional |
| Redis free apagado por 14 dias de inatividade     | Médio   | `/health/deps` alerta em 5 min           | Se houver novo outage longo              |
| Staging inexistente                               | Médio   | Deploy direto para produção com CI verde | G4-01                                    |
| Sem SLO declarado                                 | Médio   | Monitoramento de disponibilidade         | G4-04                                    |
| Allowlist de segurança com 4 entradas             | Baixo   | ADR-014, ADR-015, gatilhos definidos     | Toda sessão que toque em dependência     |

---

# Princípios que este projeto já aprendeu a respeitar

Extraídos das 66 lições registradas em `PROJECT_HISTORY.md`. Valem como critério
de revisão para qualquer trabalho futuro.

1. **Infraestrutura declarada não é infraestrutura existente** (#57). Só conta
   depois de rodar verde uma vez.
2. **Corrigir no repositório não é corrigir em produção** (#63). Verificar no
   runtime, não no pipeline.
3. **Degradação graciosa sem alarme é uma falha que aprendeu a ficar quieta**
   (#65). Todo `catch` que segue com capacidade reduzida precisa publicar esse
   estado.
4. **Alerta não testado é alerta inexistente** (#53).
5. **Observabilidade interna não detecta ausência** (#52). Serviço desligado
   produz silêncio, e silêncio parece saúde.
6. **Item de backlog carrega a premissa de quem o escreveu** (#66). Verificar o
   estado real antes de executar — dois itens de S84 estavam factualmente errados.
7. **Documentação falsamente favorável é pior que documentação ausente** (#48).
   Ausência provoca investigação; otimismo errado provoca decisão errada.
8. **Contas e cobrança são parte da arquitetura** (#54). 79 suítes de teste não
   impediram 8 semanas de indisponibilidade por uma fatura de US$ 5.

---

_Manter este documento vivo. Ao concluir um item, marcar com a evidência que
satisfez o critério de aceite — não apenas com um "x"._
