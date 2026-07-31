# Inventario de infraestrutura e custos

**Ultima verificacao:** 2026-07-30
**Responsavel:** Pedro Leme Perin
**Motivo de existir:** action item A6 do postmortem
[`2026-07-30-railway-trial-expiry-outage`](postmortems/2026-07-30-railway-trial-expiry-outage.md).
A ausencia deste documento e uma das causas contribuintes daquele incidente — a pergunta
"o que precisa continuar sendo pago para o produto funcionar?" nao tinha resposta escrita.

> **Regra de manutencao:** revisar a cada mudanca de plano, troca de cartao ou novo
> fornecedor. Verificacao completa no minimo **trimestral**. Campos marcados `?`
> significam nao verificado — trata-los como risco, nao como zero.

---

## 1. Resumo executivo

| Categoria       | Fornecedores                                                | Custo mensal conhecido   |
| --------------- | ----------------------------------------------------------- | ------------------------ |
| Pago recorrente | Railway, Google Workspace                                   | US$ 5,00 + ~R$ 35,00     |
| Pago anual      | Cloudflare (dominio)                                        | ~US$ 10,00/ano           |
| Pago por uso    | Twilio, OpenAI, Deepgram, Cloudflare R2                     | variavel, saldo pre-pago |
| Free tier       | Vercel, Neon, Upstash, Clerk, Sentry, Axiom, Resend, GitHub | R$ 0                     |

**Custo fixo mensal estimado:** ~R$ 63 (Railway + Workspace).

---

## 2. Por criticidade — o que quebra se cair

### Tier 1 — perda irreversivel

Falha aqui nao e recuperavel com dinheiro depois. Exige vigilancia ativa.

| Fornecedor           | Item                          | Se cair                                                                                                                                                          | Verificar                                   |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Google Workspace** | `pedro.perin@theiadvisor.com` | E o **login da conta Stripe**. Perder a caixa repete o desastre que ja custou a conta Stripe anterior. Tambem derruba `team@` e `dpo@` (contato LGPD publicado). | Enviar e receber um e-mail de teste         |
| **Twilio**           | Numero `+1 507 763 4719`      | Saldo pre-pago. Zerado, a Twilio **libera o numero** de volta ao pool. Nao ha recuperacao. Webhooks e config de voz apontam para ele.                            | Painel Twilio → Balance                     |
| **Cloudflare**       | Dominio `theiadvisor.com`     | Renovacao anual. Expirado → periodo de graca → liberado a terceiros. Derruba frontend, API, e-mail e DKIM simultaneamente.                                       | `whois theiadvisor.com` → data de expiracao |

### Tier 2 — suspende, mas recupera

| Fornecedor        | O que faz         | Se cair                                                                                                | Verificar                                 |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Railway**       | Backend NestJS    | Toda a API fora. **Foi exatamente o incidente de 2026-07-30.**                                         | `curl https://api.theiadvisor.com/health` |
| **Neon**          | PostgreSQL        | Sem banco, o backend sobe mas falha em toda query. Compute auto-suspende sem trafego; dados persistem. | O campo `services.database` do `/health`  |
| **Vercel**        | Frontend Next.js  | Site fora. Paginas estaticas caem junto.                                                               | `curl https://theiadvisor.com`            |
| **Upstash**       | Redis             | Rate limiting, cache, adapter de WebSocket e idempotencia de webhook degradam.                         | Painel Upstash                            |
| **Cloudflare R2** | Uploads + backups | Uploads falham; backup noturno perde destino.                                                          | `uploads.theiadvisor.com` responde        |
| **Clerk**         | Autenticacao      | Ninguem consegue logar.                                                                                | Fluxo de sign-in                          |

### Tier 3 — degrada com fallback

| Fornecedor         | Se cair                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **OpenAI**         | Circuit breaker abre → sugestao generica pre-definida. Produto perde o valor central, mas nao cai. |
| **Deepgram**       | Transcricao de ligacoes para. WhatsApp segue.                                                      |
| **Resend**         | E-mails transacionais nao saem (convites, dunning, DSAR).                                          |
| **Sentry / Axiom** | Perda de observabilidade. Nao afeta o usuario — afeta a capacidade de perceber problemas.          |

---

## 3. Detalhamento por fornecedor

| #   | Fornecedor               | Plano                  | Custo               | Ciclo                   | Conta dona                       | Renovacao       | Status                                  |
| --- | ------------------------ | ---------------------- | ------------------- | ----------------------- | -------------------------------- | --------------- | --------------------------------------- |
| 1   | **Railway**              | Hobby                  | US$ 5/mes + uso     | mensal                  | `leme.baseapr@gmail.com` ⚠️      | 30 de cada mes  | ✅ ativo desde 2026-07-30               |
| 2   | **Vercel**               | Hobby                  | US$ 0               | —                       | ?                                | —               | ✅ ativo                                |
| 3   | **Neon**                 | ? (provavel Free)      | ?                   | ?                       | ?                                | —               | ✅ ativo — **PITR nao confirmado (A7)** |
| 4   | **Upstash**              | Free / pay-per-request | ~US$ 0              | por uso                 | ?                                | —               | ✅ presumido                            |
| 5   | **Cloudflare — DNS/CDN** | Free                   | US$ 0               | —                       | `leme.baseapr@gmail.com` ⚠️      | —               | ✅ ativo                                |
| 6   | **Cloudflare — dominio** | Registrar at cost      | ~US$ 10/ano         | anual                   | `leme.baseapr@gmail.com` ⚠️      | **? verificar** | ✅ ativo                                |
| 7   | **Cloudflare R2**        | pay-as-you-go          | centavos            | por uso                 | idem                             | —               | ✅ `uploads` proxied                    |
| 8   | **Clerk**                | Free (≤10k MAU)        | US$ 0               | —                       | ?                                | —               | ✅ 5 registros DNS ok                   |
| 9   | **Google Workspace**     | Business Starter       | ~R$ 35/usuario/mes  | mensal                  | ?                                | ?               | ✅ MX respondendo                       |
| 10  | **Twilio**               | pay-as-you-go          | ~US$ 1,15/mes + uso | saldo                   | ?                                | —               | **? saldo nao verificado**              |
| 11  | **OpenAI**               | creditos pre-pagos     | por uso             | creditos expiram em 12m | ?                                | —               | **? saldo nao verificado**              |
| 12  | **Deepgram**             | creditos pre-pagos     | por uso             | creditos expiram        | ?                                | —               | **? saldo nao verificado**              |
| 13  | **Resend**               | Free (3k e-mails/mes)  | US$ 0               | —                       | ?                                | —               | ✅ DKIM + SPF ok                        |
| 14  | **Sentry**               | Developer (free)       | US$ 0               | —                       | ?                                | —               | ✅ presumido                            |
| 15  | **Axiom**                | Free                   | US$ 0               | —                       | ?                                | —               | ✅ presumido                            |
| 16  | **GitHub**               | Free                   | US$ 0               | —                       | `pedro-leme-perin`               | —               | ✅ ativo                                |
| 17  | **Stripe**               | sem custo fixo         | % por transacao     | —                       | `pedro.perin@theiadvisor.com` ✅ | —               | ⚠️ LIVE pendente de Identity PJ         |

---

## 4. Riscos de governanca

### 4.1 Ativos criticos sob conta pessoal

**Railway** e **Cloudflare** estao sob `leme.baseapr@gmail.com`. A Stripe estava tambem —
e foi perdida. O padrao e o mesmo, e o Cloudflare e o mais grave dos tres: quem controla
a zona controla frontend, API, e-mail e DKIM de uma vez.

Consequencia pratica alem do risco de perda: avisos de cobranca e vencimento chegam a uma
caixa pessoal, nao a `pedro.perin@theiadvisor.com`, que e a monitorada para assuntos da
empresa. Foi assim que a expiracao do trial passou despercebida.

**Acao:** A9 do postmortem.

### 4.2 Faturamento em nome de pessoa fisica

O recibo da Railway (`LV3KXVXW-0003`) e emitido para `leme.baseapr@gmail.com`. Sao
despesas operacionais da THEIADVISOR SAAS TECNOLOGIA LTDA faturadas para PF. Nota em nome
de PF nao compoe despesa dedutivel da PJ e complica a contabilidade.

### 4.3 2FA sem redundancia

Confirmado apenas para a conta Stripe nova (e ainda pendente de hardening). Para os demais
fornecedores, desconhecido. A licao #45 — passkey unica sem backup codes — ja custou uma
conta.

---

## 5. Como verificar tudo — rotina trimestral

```bash
# 1. Producao viva ponta a ponta
curl -s https://api.theiadvisor.com/health | head -c 300   # espera-se 200 + database ok
curl -s -o /dev/null -w "%{http_code}\n" https://theiadvisor.com

# 2. DNS integro (14 registros esperados)
dig +short api.theiadvisor.com
dig +short theiadvisor.com MX
dig +short theiadvisor.com

# 3. Dominio nao esta perto de expirar
whois theiadvisor.com | grep -i "expir"

# 4. Backup noturno rodou
#    GitHub → Actions → "Postgres Nightly Backup" → ultimo run verde?
#    R2 → bucket theiadvisor-backups → postgres/<hoje>/manifest.json existe?
```

Alem disso, conferir manualmente nos paineis: saldo da Twilio, creditos da OpenAI e da
Deepgram, e a data do proximo ciclo na Railway.

---

## 6. Pendencias deste documento

| ID  | O que falta                                   | Bloqueia                         |
| --- | --------------------------------------------- | -------------------------------- |
| P1  | Plano e retencao de PITR da Neon              | Saber o RPO real do banco        |
| P2  | Saldo Twilio                                  | Risco Tier 1 — perda do numero   |
| P3  | Saldo/validade dos creditos OpenAI e Deepgram | Funcionamento do produto         |
| P4  | Conta dona de cada fornecedor (coluna `?`)    | Avaliacao de risco de governanca |
| P5  | Data de renovacao do dominio                  | Risco Tier 1                     |
| P6  | Estado do 2FA por fornecedor                  | Risco de perda de conta          |

Preencher exige acesso autenticado a cada painel. Cada linha `?` e um risco nao medido —
nao um risco ausente.
