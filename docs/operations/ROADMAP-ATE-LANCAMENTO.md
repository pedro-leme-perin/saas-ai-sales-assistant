# Roadmap até o lançamento — TheIAdvisor

**Criado:** 2026-07-31 (S84) · **Base:** auditoria de 46 módulos backend, 41 telas frontend, 92 suítes de teste, infraestrutura em 6 provedores
**Revisado:** 2026-08-01 (S85) — GATE 1 e GATE 2 reescritos contra o estado real da Railway, da Stripe e do código. Duas premissas de S83 revogadas; caminho crítico refeito
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

**Reescrito em S85.** A versão anterior colocava "Stripe Identity PJ" e "verificação
Meta" como as duas esperas dominantes. Nenhuma das duas era o gargalo real: a Stripe já
está verificada (na entidade errada) e a Meta não participa do canal WhatsApp deste
produto.

```
G2-00 Decidir a conta Stripe ──→ destrava TODO o portão 2
      (decisão sua, minutos)     │
                                 ├──→ G2-01 cadastro PJ  (1-3 dias de análise)
                                 └──→ G2-05 conta de repasse  ← receita represada sem isto
                                          │
                                          ↓
                                    receber pagamento

G1-01 WhatsApp Sender Twilio ────────→ canal WhatsApp em produção
      (1-5 dias de análise)              │
      └─ sandbox Twilio ───────────────→ smoke E2E JÁ, sem espera
                                         │
G1-02 Número Twilio BR ──────────────→ canal telefone operacional
      (verificar o que já existe)        │
                                         ↓
                              G3 → primeiro usuário real
```

**Ordem:** G2-00 primeiro, porque é decisão sua e trava seis itens. Depois G2-01 e G1-01
no mesmo dia — os dois são análise de terceiro e rodam em paralelo. G2-05 pode correr
junto e é o mais subestimado da lista: sem conta de repasse, cobrar é acumular saldo que
não sai.

**O sandbox da Twilio desacopla G1-03 da espera.** O smoke E2E do WhatsApp exercita
exatamente o mesmo caminho de código com sandbox ou com sender verificado. Não há razão
para esperar a verificação antes de descobrir falhas de integração.

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

> **Revisão S85 (2026-08-01).** Este portão foi reescrito depois de conferir as 42
> variáveis da Railway e o código dos dois canais. G1-01 descrevia uma integração que o
> produto **não implementa**. Detalhe e evidência:
> [`docs/operations/s85/STRIPE_STATE_CORRECTION.md`](s85/STRIPE_STATE_CORRECTION.md) §2.3.

### G1-01 · Habilitar WhatsApp Sender na Twilio 🔴

- **Dono:** Pedro · **Latência:** 1–5 dias úteis (a verificação de empresa da Meta
  acontece **por dentro** do fluxo da Twilio, não antes dele)
- **Bloqueia:** canal WhatsApp inteiro, G1-03, lançamento
- **Correção S85:** o item anterior mandava criar um app no Meta Business Manager e
  obter `Phone Number ID` + `Access Token`. **O código não usa nada disso.**
  `WhatsappService` (`whatsapp.service.ts:103-114`) instancia o cliente Twilio e envia
  por `TWILIO_WHATSAPP_NUMBER`, com fallback para o número de sandbox
  `whatsapp:+14155238886`. O webhook recebido é `TwilioWebhookPayload`
  (`From`/`To`/`Body`/`ProfileName`/`NumMedia`), formato Twilio. As variáveis
  `WHATSAPP_API_URL`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` e
  `WHATSAPP_WEBHOOK_SECRET` aparecem só em `configuration.ts` e `env.validation.ts` —
  **nenhum serviço as lê**, e das cinco só `WHATSAPP_VERIFY_TOKEN` existe na Railway.
- **Passos:** console Twilio → Messaging → WhatsApp senders → submeter o número com o
  CNPJ 67.084.607/0001-78 → apontar o webhook de entrada para
  `https://api.theiadvisor.com/api/whatsapp/webhook` → preencher `TWILIO_WHATSAPP_NUMBER`
  na Railway no formato `whatsapp:+55…`
- **Atalho para destravar G1-03 hoje:** o **sandbox** da Twilio funciona sem verificação
  nenhuma. Número `+1 415 523 8886`, código de pareamento `join activity-surprise`. Serve
  para provar a integração ponta a ponta enquanto a verificação corre; **não** serve para
  atender cliente
- **✅ Feito em S85 — webhooks do sandbox corrigidos.** Estavam apontando para um túnel
  ngrok morto, sobra de desenvolvimento local: `callback_url` em
  `https://unfrank-felecia-effectually.ngrok-free.dev/api/whatsapp/webhook` e
  `status_callback_url` em `…ngrok-free.app/api/whatsapp/webhook/status` — note que nem os
  domínios batiam entre si. Trocados para `https://api.theiadvisor.com/api/whatsapp/webhook`
  e `…/webhook/status`, salvos e confirmados após recarregar a página. **Enquanto isso
  esteve assim, nenhuma mensagem do sandbox jamais chegou ao backend**
- **Aceite:** mensagem enviada de um celular real chega no dashboard e a IA devolve sugestão
- **Verificar:** enviar mensagem para o número e observar o registro em `/dashboard/whatsapp`
- **🔴 Bloqueio remanescente — `Company.whatsappPhoneNumberId`.** `processWebhook` chama
  `findCompanyByWhatsAppNumber(toNumber)` e **descarta a mensagem em silêncio** se nenhuma
  empresa tiver aquele número. Busca em `apps/` inteira: o campo é **lido** em
  `onboarding.service.ts` e consultado em `whatsapp.service.ts:454`, mas **nunca escrito** —
  não há endpoint, DTO nem tela que o defina. Hoje só se popula por SQL direto no Neon.
  Para o smoke pelo sandbox, a `Company` de produção precisa de
  `whatsapp_phone_number_id = '+14155238886'`. Dívida associada: expor o campo em
  `/dashboard/settings` (Claude Code)

### G1-02 · Número Twilio de voz 🔴

- **Dono:** Pedro · **Latência:** imediata (é compra)
- **Bloqueia:** canal telefone, transcrição, coaching em ligação
- **Estado verificado em S85:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER`, `TWILIO_WEBHOOK_URL` e `TWILIO_WHATSAPP_NUMBER` **existem** na
  Railway. `CLAUDE.md` §2.1 registra o número **+1 507 763 4719** — americano. Ou seja:
  um número existe e o canal pode já estar operante; o que falta é um número **BR**
- **Inventário conferido no console em S85:** a conta ("My first Twilio account") tem
  **exatamente um número ativo — `+1 507 763 4719`**, com capacidade de voz, SMS, MMS e
  fax. **Nenhum `+55`.** SID `PNe732708ff1c66c1589097c42235005b4`
- **✅ Feito em S85 — webhooks de voz repontados para o domínio próprio.** Estavam em
  `https://saas-ai-sales-assistant-production.up.railway.app/api/calls/webhook/voice` e
  `…/status`, o domínio gerado pela Railway. Trocados para `https://api.theiadvisor.com/…`,
  salvos e confirmados após recarregar. O domínio gerado muda se o serviço for recriado;
  o domínio próprio é o contrato estável
- **Dívida menor registrada:** a `Messaging URL` desse número aponta para
  `https://demo.twilio.com/welcome/sms/reply`, o padrão de demonstração da Twilio — nunca
  configurado. Sem efeito hoje, porque o produto não trata SMS. Corrigir junto com a compra
  do número BR, ou deixar em branco
- **Falta:** comprar o número `+55` e apontar os mesmos dois webhooks nele
- **Aceite:** ligação real transcrita e visível em `/dashboard/calls`
- **Custo:** número BR ~US$ 1–2/mês + uso por minuto

### G1-03 · Smoke E2E dos dois canais 🔴

- **Dono:** Pedro executa, Cowork acompanha · **Depende de:** G1-01, G1-02
- **Aceite:** roteiro completo executado com sucesso: **(a)** ligação recebida →
  transcrita → sugestão da IA aparece; **(b)** mensagem WhatsApp → resposta
  sugerida → envio; **(c)** ambas registradas em Analytics
- **Por que importa:** teste unitário não pega falha de integração entre
  componentes (lição #26)
- **Nota S85:** a metade WhatsApp deste item é executável **hoje** pelo sandbox da Twilio,
  sem esperar verificação de empresa. Rodar assim antecipa a descoberta de falhas de
  integração em dias, e o caminho de código exercitado é exatamente o mesmo

### G1-04 · Remover mock órfão ⚪ — **arquivo removido em S85, aguardando CI**

- **Dono:** Claude Code · **Esforço:** 2 min
- **Item:** `apps/frontend/src/services/analytics.service.ts` não é importado por
  ninguém — o dashboard usa o serviço real de `api.ts`
- **Evidência da orfandade (S85):** o símbolo `analyticsService` é exportado em dois
  lugares (`services/analytics.service.ts:4` e `services/api.ts:593`); os três
  consumidores — `dashboard/page.tsx`, `dashboard/analytics/page.tsx`,
  `dashboard/audit-logs/page.tsx` — importam todos de `@/services/api`. Não existe
  `services/index.ts`, logo não há reexportação em barril. O conteúdo do arquivo era um
  mock com números fixos (`totalCalls: 247`) e um `API_URL` declarado e nunca usado
- **Aceite:** arquivo removido, `pnpm tsc --noEmit` e `pnpm build` do frontend passam
- **Estado:** removido do working tree; falta `tsc`/`build`/commit no Claude Code

---

# GATE 2 — Capacidade comercial

> **Objetivo:** você pode cobrar e emitir nota fiscal legalmente.

> **Revisão S85 (2026-08-01).** Este portão inteiro estava construído sobre a premissa de
> que a conta Stripe original fora perdida e que a produção rodava numa conta nova, em TEST.
> **As duas coisas são falsas.** A produção está em LIVE, na conta original, que responde
> normalmente. Ver [`s85/STRIPE_STATE_CORRECTION.md`](s85/STRIPE_STATE_CORRECTION.md).
> Consequência: LIVE deixa de ser um portão a abrir e vira um estado a **regularizar**.

### G2-00 · Decidir qual conta Stripe segue 🔴 · **NOVO, INICIAR PRIMEIRO**

- **Dono:** Pedro · **Esforço:** decisão, não execução
- **Bloqueia:** G2-01 a G2-05. Nada em Stripe avança antes disto
- **Escolha:** manter `acct_1T6DHFJ1Cbnf5voG` (produção hoje, LIVE, cadastro **pessoa
  física**, login `leme.baseapr@gmail.com`) ou migrar para `acct_1TgU9WRpJ3I7SP8K`
  (só TEST, login institucional, cadastro PJ desde o início)
- **Trade-off completo:** `s85/STRIPE_STATE_CORRECTION.md` §4. Recomendação técnica
  registrada lá: **migrar**, pelo custo de troca ser mínimo agora e proibitivo depois do
  primeiro pagamento — mas a escolha é sua e há contra-argumento legítimo
- **Pré-requisito da opção "manter":** confirmar, numa janela anônima e com logout
  completo, que o 2FA de `acct_1T6DHFJ1Cbnf5voG` é de fato utilizável. A sessão aberta
  hoje pode ser apenas um cookie sobrevivente
- **Aceite:** decisão registrada em `CLAUDE.md` §2.3 com uma linha de justificativa

### G2-01 · Cadastro como pessoa jurídica 🔴

- **Dono:** Pedro · **Latência:** 1–3 dias úteis · **Depende de:** G2-00
- **Bloqueia:** G2-06 (NFS-e coerente com quem recebe), G2-05
- **Contexto S85:** a conta de produção está cadastrada como **pessoa física** — "Outras
  informações fornecidas: CPF, Telefone", endereço residencial tipo "Casa". Não há tarefa
  de verificação pendente; o cadastro está completo, só que na entidade errada
- **Documentos:** CNPJ 67.084.607/0001-78 · contrato social · RG · comprovante de
  endereço PJ
- **Aceite:** painel da conta exibindo a pessoa jurídica, sem tarefa pendente em
  "Status da conta"
- **Por que importa mesmo já cobrando:** receber como PF e emitir NFS-e como PJ são
  fatos fiscais incompatíveis

### G2-02 · Stripe 2FA com redundância 🔴

- **Dono:** Pedro · **Esforço:** 15 min · **Depende de:** G2-00
- **Contexto corrigido em S85:** a conta anterior **não foi perdida**. O que se perdeu foi
  um fator de autenticação — passkey sem TOTP e sem backup codes — e a recuperação por
  aquele formulário específico foi negada. A chave `sk_live_*` seguiu autenticando o tempo
  todo, e é por isso que a produção nunca parou (lições #45 e #67)
- **Aceite:** na conta escolhida em G2-00: passkey **e** TOTP **e** 10 backup codes
  guardados em 2 locais distintos, um deles offline. Critério: perder qualquer um dos três
  não bloqueia o acesso

### G2-03 · Alinhar LIVE mode à conta escolhida 🔴

- **Dono:** Cowork · **Depende de:** G2-00
- **Se a decisão for manter:** nada a fazer. LIVE já está ativo com
  `price_1TGufH…` / `price_1TGuhy…` / `price_1TGuja…` (ver `CLAUDE.md` §2.3)
- **Se a decisão for migrar:** recriar 3 products + 3 prices + webhook de 6 eventos com
  `--live` na conta nova → trocar as 6 variáveis (5 Railway + 1 Vercel) → atualizar
  `CLAUDE.md` §2.3 no mesmo commit
- **Aceite:** os 3 `STRIPE_PRICE_*` da Railway e a `STRIPE_PUBLISHABLE_KEY` compartilhando
  o mesmo componente de conta, e o webhook ativo no painel
- **Verificação barata (lição #68):** comparar os IDs. `pk_live_51<X>…` e `price_1<Y><X>…`
  precisam ter o mesmo `<X>`. Se divergirem, a configuração está partida entre duas contas
- **Armadilha (lição #50):** na CLI use `-d "chave=valor"`; `--metadata[k]=v` e
  `--description` não existem e falham em silêncio

### G2-04 · Checkout real ponta a ponta 🔴

- **Dono:** Pedro · **Depende de:** G2-03
- **Aceite:** uma assinatura real comprada com cartão real, registro criado em
  `Subscription` no banco, webhook processado, acesso liberado ao plano
- **Nota:** pode ser você mesmo comprando o plano mais barato e cancelando
- **Nota S85:** o último precedente é a sessão A4 (abril/2026), que criou um
  `cs_live_a1GgPI…` com sucesso. O caminho de checkout já funcionou em LIVE ao menos uma
  vez — o que nunca foi exercitado é o pagamento consumado e o webhook de volta

### G2-05 · Conta bancária de repasse 🔴 · **severidade elevada em S85**

- **Dono:** Pedro · **Depende de:** G2-00
- **Achado S85:** o painel da conta de produção mostra **`Repasses: —`**. Não há conta
  bancária cadastrada. Sem isso o checkout aprova, o dinheiro entra no saldo da Stripe e
  **nunca sai**
- **Era 🟠 e virou 🔴:** cobrar sem destino de repasse não é dívida operacional, é receita
  represada — e com cliente pagante do outro lado, é obrigação assumida sem contrapartida
- **Destino:** Inter PJ, agência 0001, chave PIX CNPJ já cadastrada (S81-EOD)
- **Aceite:** transferência de teste da Stripe cai na conta Inter PJ
- **Armadilha (lição #43):** o Kaspersky Safe Money intercepta domínios bancários —
  escolher "Continuar sem proteção" em fluxos automatizados

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

| ID    | Item                                                                            | Dono        | Aceite                                                              |
| ----- | ------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| G5-01 | Triar 16 PRs do Dependabot (abertos desde 28/04)                                | Claude Code | Nenhum PR com mais de 30 dias em aberto                             |
| G5-02 | Cobertura 77/66/75/77 → 80% (meta da §9)                                        | Claude Code | `coverageThreshold` elevado com CI verde                            |
| G5-03 | ~~Commitar spec do `api-key.guard`~~ ✅ **já feito em S64-A**, commit `b4f5fd1` | —           | 468 linhas, 25 testes em 10 describes, rastreado. Verificado em S85 |
| G5-04 | Vulnerabilidades médias `qs` e `uuid`                                           | Claude Code | 1 override por commit (lição #17)                                   |
| G5-05 | Bundle 2,90 MB → ≤ 2 MB                                                         | Claude Code | `pnpm run analyze` abaixo do limiar de aviso                        |
| G5-06 | Revisar allowlist de segurança a cada sessão que toque em dependência           | Claude Code | Gatilhos do ADR-015 reavaliados                                     |

---

# Definição de "pronto para lançar"

O produto está pronto quando **todas** as afirmações abaixo forem verdadeiras e
tiverem sido **verificadas em produção**, não presumidas:

1. Uma ligação real é recebida, transcrita, e a IA sugere resposta — G1
2. Uma mensagem de WhatsApp real é recebida e respondida com apoio da IA — G1
3. Um cartão real compra uma assinatura e libera acesso — G2
4. **O dinheiro dessa cobrança chega na conta bancária** — G2-05 (acrescentado em S85:
   até aqui a definição terminava no checkout, que é metade do circuito)
5. Uma NFS-e é emitida para essa cobrança — G2
6. As credenciais em uso hoje foram rotacionadas depois da última exposição — G3
7. O backup foi restaurado ao menos uma vez com sucesso — G3
8. Se qualquer um dos itens acima quebrar às 3h da manhã, chega alerta — G0 ✅

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

Extraídos das 69 lições registradas em `PROJECT_HISTORY.md`. Valem como critério
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
   estado real antes de executar — dois itens de S84 estavam factualmente errados,
   e em S85 o portão 2 inteiro descansava sobre uma premissa falsa de S83.
7. **Documentação falsamente favorável é pior que documentação ausente** (#48).
   Ausência provoca investigação; otimismo errado provoca decisão errada.
8. **Contas e cobrança são parte da arquitetura** (#54). 79 suítes de teste não
   impediram 8 semanas de indisponibilidade por uma fatura de US$ 5.
9. **Perder um fator de autenticação não é perder a conta** (#67). Acesso ao painel e
   acesso à API são planos independentes. Testar o plano que interessa antes de declarar
   qualquer coisa perdida.
10. **Identificador opaco deixa de ser opaco quando carrega a chave estrangeira** (#68).
    IDs prefixados da Stripe embutem o componente da conta — comparar dois IDs responde
    "mesma conta?" sem chamar API nenhuma.
11. **Variável de ambiente declarada não é integração existente** (#69). Quatro variáveis
    `WHATSAPP_*` viveram na configuração e na documentação por dezenas de sessões sem que
    uma linha de serviço as lesse. Auditar canal começando pelo código que envia.

---

_Manter este documento vivo. Ao concluir um item, marcar com a evidência que
satisfez o critério de aceite — não apenas com um "x"._
