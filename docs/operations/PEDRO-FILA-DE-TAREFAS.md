# Fila de tarefas do Pedro — uma por vez

**Criada:** 2026-08-01 (S85)
**Regra:** uma tarefa ativa por vez. A próxima só é apresentada depois que a atual for
concluída e verificada. Ver `CLAUDE.md` §0.

**Como usar:** o assistente lê esta fila antes de propor qualquer coisa, entrega **somente**
a tarefa marcada como `▶ ATIVA`, e ao concluí-la move a marca para a seguinte.

---

## Concluídas em 01/08/2026

| #   | Tarefa                                    | Evidência                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | **Decidir qual conta Stripe segue**       | Fica `acct_1T6DHFJ1Cbnf5voG`. Acesso confirmado em sessão anônima; login já é `pedro.perin@theiadvisor.com`; conta em LIVE sem pendência de verificação                                                                                                                                                                                                                                            |
| ✅  | **Blindar o 2FA da Stripe**               | Aplicativo autenticador + chave de segurança + código de backup de 24 caracteres guardado em 2 locais + e-mail de backup + telefone de contato                                                                                                                                                                                                                                                     |
| ✅  | **Pagar o Google Workspace**              | Confirmado pelo Pedro em 01/08. **Não verificado no painel** — o `admin.google.com` pediu login na sessão do assistente. Reconferir na próxima vez que ele estiver logado                                                                                                                                                                                                                          |
| ✅  | **Ativar a conta nova da Stripe como PJ** | `acct_1TgU9JRufXYWW9J9` saiu do modo de teste e entrou em produção em 03/08. Preenchido no onboarding: Pessoa Jurídica · Sociedade Limitada Unipessoal (SLU) · CNPJ 67.084.607/0001-78 · categoria Software · descrição do produto reescrita (a que veio preenchida descrevia outro negócio) · descrição no extrato `THEIADVISOR` · documento com foto + selfie enviados · Radar no plano **Lite** |
| ✅  | **Cadastrar a conta bancária de repasse** | Inter PJ, agência 0001, mesmo CNPJ da conta. Feito dentro do próprio fluxo de ativação — a tarefa 3 da fila saiu junto com a 2                                                                                                                                                                                                                                                                     |

---

## ~~Tarefa 1: pagar o Google Workspace~~ — concluída 01/08

**Por que é a primeira, à frente de tudo:** a suspensão foi anunciada para **03/08**. Hoje é
01/08. Se a conta suspender:

- `team@theiadvisor.com` para de funcionar — e é o remetente de **todo** e-mail que o
  produto envia (convite de equipe, recuperação, cobrança, CSAT, relatórios);
- `dpo@theiadvisor.com` para de funcionar — é o contato do encarregado de dados exigido
  pela LGPD e publicado na política de privacidade;
- `pedro.perin@theiadvisor.com` para de funcionar — e **é o login da sua conta Stripe**.

Esse último ponto é o que torna isso urgente de verdade. Perder o Workspace agora significa
perder o acesso à Stripe pela segunda vez, pelo mesmo tipo de causa da primeira. O 2FA que
você acabou de blindar não protege contra isso, porque o problema seria o e-mail, não o
fator de autenticação.

**O que fazer:** entrar em `admin.google.com`, ir em Faturamento, e regularizar o pagamento.

**Como saber que terminou:** o aviso de suspensão some do painel e a assinatura aparece como
ativa.

---

## Fila — na ordem, uma de cada vez

### ~~Tarefa 2: Stripe, cadastro PJ~~ — CONCLUÍDA 03/08, verificação em análise

> **A decisão G2-00 foi revertida em 02/08, por fato novo.** Ver o bloco de achado abaixo.

**O achado.** A aba "Dados fiscais" de `acct_1T6DHFJ1Cbnf5voG` diz, textualmente:
_"Seus dados fiscais já foram verificados. Se seu ID fiscal mudou, você precisará criar outra
conta."_ Não há caminho de auto-atendimento nem de suporte: conta com identificação fiscal
verificada **não troca de titular fiscal** na Stripe. O formulário de "Dados comerciais" só
expõe Setor, Site e Descrição do produto.

**Consequência.** Manter a conta atual significa receber para sempre no CPF do Pedro. Como o
produto emite NFS-e pelo CNPJ, isso é incoerência fiscal — dinheiro entrando na pessoa física
e nota saindo da jurídica. Logo, migrar deixou de ser preferência e virou requisito.

**Destino:** `acct_1TgU9JRufXYWW9J9` — a conta nova de S83, ainda **não ativada**.

> **Correção de identificador (02/08).** S83 registrou `acct_1TgU9WRpJ3I7SP8K` como "a conta
> nova". **É o sandbox dela**, não a conta. A estrutura real são três identificadores:
>
> | ID                      | O que é                                                                       |
> | ----------------------- | ----------------------------------------------------------------------------- |
> | `acct_1T6DHFJ1Cbnf5voG` | conta de produção atual — LIVE, cadastro CPF                                  |
> | `acct_1TgU9JRufXYWW9J9` | **conta nova, pendente de ativação** — o destino                              |
> | `acct_1TgU9WRpJ3I7SP8K` | sandbox da conta nova — onde estão os 3 products, 3 prices e o webhook de S83 |
>
> Os dois últimos compartilham o prefixo `1TgU9`, criados no mesmo momento. Navegar para
> `/settings/account` em `1TgU9W` força redirect para `/test/settings/account`: sandbox não
> tem modo de produção. Foi assim que o engano de S83 se revelou.
>
> Consequência prática: os products e prices de S83 estão no **sandbox**, não na conta.
> Precisarão ser recriados em LIVE depois da ativação. Nada se perde além do retrabalho de
> alguns minutos.

**Passo desta tarefa:** entrar nessa conta e completar o cadastro como pessoa jurídica com o
CNPJ 67.084.607/0001-78. Isso inicia a verificação, que leva **1 a 3 dias úteis** — por isso
vem primeiro, para o relógio correr enquanto o resto anda.

**Documentos:** cartão CNPJ (emitir em gov.br), contrato social (JUCESP), RG, comprovante de
endereço da empresa.

**Ainda não faça:** 2FA na conta nova, payout, LIVE mode e troca das variáveis. Cada um vira
uma tarefa própria depois que a verificação sair.

**O que NÃO foi desperdiçado:** o 2FA blindado hoje em `acct_1T6DHFJ1Cbnf5voG` continua
valendo — ela segue sendo a conta de produção até a migração terminar, e precisa estar segura
justamente por isso.

### ~~Tarefa 3 — Stripe: conta bancária de repasse~~ — CONCLUÍDA 03/08, saiu junto com a tarefa 2

O painel mostra `Repasses: —`. Não há conta bancária. Hoje, se alguém pagasse, o dinheiro
entraria no saldo da Stripe e **nunca sairia de lá**.

Destino: Inter PJ, agência 0001, com a chave PIX do CNPJ que já foi cadastrada.

### ⏸ SUSPENSA — Tarefa 4: Twilio, habilitar o WhatsApp Sender

> **Suspensa em 03/08 por achado de arquitetura.** Não execute esta tarefa antes de resolver
> a decisão registrada em `docs/operations/s86/WHATSAPP_MULTITENANT.md`. Habilitar um sender
> agora não é errado — serve de ambiente de teste e conta de demonstração — mas **não é o que
> os clientes vão usar**, e o modelo ainda não está definido.

**O achado.** O canal WhatsApp é meio multi-inquilino e meio single-tenant:

- **recebe** multi-tenant — `findCompanyByWhatsAppNumber(toNumber)` resolve o tenant pelo
  número de destino;
- **envia** single-tenant — `whatsapp.service.ts:349` usa `this.sandboxNumber`, que vem de
  `TWILIO_WHATSAPP_NUMBER`, **uma variável global da aplicação**. Não há número por tenant.

Com um número só, o roteamento de entrada sempre acha a mesma company. O canal não suporta
dois clientes.

**Requisito do produto, definido pelo Pedro em 03/08:** o cliente usa **o número dele**, e
esse número **continua funcionando no celular dele normalmente**.

**O que isso exige:** o recurso da Meta chamado **coexistência** (lançado em maio/2025),
que permite o app e a Cloud API no mesmo número. Restrições conhecidas: exige o app
**WhatsApp Business** (não o WhatsApp comum) e **cai se o cliente passar 14 dias sem abrir o
app** — dependência operacional séria para um SaaS.

**Bloqueio:** indício de que **a Twilio não suporta coexistência** (confiança baixa — fonte
única, de concorrente; a documentação oficial da Twilio não menciona). Se confirmado, atender
o requisito exige trocar a Twilio pela Cloud API da Meta ou por outro provedor.

**Próximo passo, e não é do Pedro:** confirmar na fonte. Ler a documentação da Twilio e, se
não for explícito, abrir chamado no suporte deles.

Console da Twilio → Messaging → WhatsApp senders. A verificação de empresa da Meta acontece
por dentro do fluxo da Twilio — **não** abra nada no Meta Business Manager.

Latência de 1 a 5 dias úteis, então vale começar cedo.

### Tarefa 5 — Migrar as contas de infraestrutura para o e-mail institucional

Railway, Cloudflare e Upstash estavam sob `leme.baseapr@gmail.com`. É a única causa raiz do
incidente de junho que continua de pé: o aviso de expiração foi para uma caixa que não é
canal operacional.

A tarefa se divide em três, porque os três provedores têm mecanismos diferentes:

| #   | Provedor   | Login é o e-mail?      | Exige senha para trocar? | De quem é   | Estado   |
| --- | ---------- | ---------------------- | ------------------------ | ----------- | -------- |
| 5a  | Railway    | Não (login via GitHub) | Não                      | assistente  | ✅ 03/08 |
| 5b  | Cloudflare | **Sim**                | **Sim**                  | Pedro       | ▶ ATIVA  |
| 5c  | Upstash    | a verificar            | a verificar              | a verificar | pendente |

**5a — Railway, concluída em 03/08.** Campo `Email` em `railway.com/account` trocado de
`leme.baseapr@gmail.com` para `pedro.perin@theiadvisor.com`. A Railway manda um e-mail de
confirmação com validade de 20 minutos; o link foi aberto e o painel recarregado já exibe o
endereço novo. Sem risco de perda de acesso porque o login é OAuth do GitHub, não o e-mail.

**5b — Cloudflare: fato novo em 03/08, a conta é SSO puro pelo Google.** Não existe senha
da Cloudflare para preencher, e o diálogo "Change Password" exige `Old password` — logo, não
há como criar uma pela tela de perfil. Achado colateral: **a 2FA da Cloudflare está
`Inactive`**, nenhum segundo fator na conta que controla o DNS de `theiadvisor.com` e o R2.

A página de Notifications também não resolve: ela configura alertas de evento (DDoS, health
check), não avisos de cobrança e renovação, que vão para o e-mail do dono.

Decisão do Pedro em 03/08: **convidar primeiro, trocar depois.**

- **5b-i — convite enviado** (assistente, 03/08). `pedro.perin@theiadvisor.com` convidado
  como Super Administrator, escopo Entire account. Painel: status `Pending`. Convite expira
  em 06/08. Cria a segunda via de acesso antes de mexer em qualquer credencial.
- **5b-ii — convite aceito** (Pedro, 03/08). Painel de Members mostra
  `pedro.perin@theiadvisor.com` · Super admin ✓ · status `Active`. A segunda via de acesso
  existe.
- **5b-iii — CANCELADA por consequência de 5b-i.** O plano era renomear o e-mail do dono
  para `pedro.perin@theiadvisor.com`. Isso deixou de ser possível: esse endereço agora
  pertence ao segundo membro, e a Cloudflare exige e-mail único por usuário. O convite
  resolveu o acesso e fechou essa porta ao mesmo tempo. Trade-off aceito conscientemente —
  acesso institucional vale mais do que o rótulo do dono.
- **5b-iv — trocar o `Billing email`** (Pedro). Rota melhor, descoberta em 03/08 ao
  procurar a saída de 5b-iii. Em `Manage account → Billing` existe um cartão
  **Billing email** hoje em `leme.baseapr@gmail.com`, com diálogo próprio
  ("Billing email preferences": New email / Confirm new email / Receive PDF invoices /
  Invoice language) e **sem exigência de senha**. É esse campo que recebe cobrança e
  renovação — exatamente a classe de aviso que se perdeu em junho. O assistente tentou
  preencher e foi bloqueado pelo classificador de segurança em formulário de cobrança,
  então o preenchimento coube ao Pedro. **Concluída em 03/08** — o cartão exibe
  `pedro.perin@theiadvisor.com`.
- **5b-v — verificação do registrador** (assistente, 03/08). `theiadvisor.com`: status
  `Active`, **`Auto-renew` ligado**, expira em 24/03/2027. O domínio não depende de alguém
  ler um aviso a tempo. O contato WHOIS padrão continua redigido pela Cloudflare.

**Saldo de 5b:** a causa raiz de junho está fechada pelo lado da Cloudflare — cobrança e
renovação agora chegam na caixa institucional, e a renovação do domínio é automática.
Permanece em aberto, na tarefa 7: **2FA `Inactive`** nos dois membros.

Registro do desenho anterior, mantido porque a análise continua válida: o diálogo
"Change Email Address" exige o campo
`Enter password`. Senha é segredo, logo não passa pelo assistente. Além disso, na Cloudflare
o e-mail **é** o login — trocar muda a identidade de acesso, não só o destino dos avisos.
Peso do que está atrás dessa conta: DNS de `theiadvisor.com` (incluindo os MX do Google
Workspace) e o bucket R2.

**5c — Upstash.** Ainda não inspecionado. Fica para depois que 5b fechar.

### Tarefa 6 — Rotacionar as credenciais expostas

O token do R2 (escopo: bucket de backups) e o usuário `neondb_owner` (escopo: **total sobre
o banco de produção**) trafegaram por captura de tela em sessão anterior. O risco foi aceito
com gatilho explícito: **antes do primeiro cliente pagante**.

Inclui também marcar `CLERK_SECRET_KEY` como "Sensitive" na Vercel — hoje qualquer pessoa
com acesso ao projeto lê o valor. **Atenção:** rotacionar a chave do Clerk sem coordenar
derruba o login do site. Essa parte precisa ser feita junto com o Claude Code.

### Tarefa 7 — 2FA com redundância nas demais contas

Railway, Cloudflare, Neon, Upstash, GitHub, Google Workspace. Mesmo padrão da Stripe: dois
fatores independentes mais código de recuperação guardado fora do computador.

### Tarefa 8 — Twilio: comprar um número brasileiro

A conta tem exatamente um número ativo, `+1 507 763 4719`, americano. Custo estimado de
US$ 1 a 2 por mês mais uso.

### Tarefa 9 — NFS-e com o contador

Sincronização do ISSnetOnline (o login libera em até 24h após a CCM, que já foi homologada)
e configuração da emissão junto ao contador.

**Risco se ignorado:** cobrar sem emitir nota é irregularidade fiscal.

### Tarefa 10 — Integralizar o capital social

R$ 1.000 via PIX de pessoa física para a pessoa jurídica, no Inter. Diferível até 12 meses,
sem risco em pré-lançamento.

### Tarefa 11 — Revisão de conformidade LGPD

Idealmente com apoio jurídico. Escopo: política de privacidade publicada, base legal do
tratamento, fluxo DSAR testado ponta a ponta, política de retenção ativa, encarregado
designado.

### Tarefa 12 — Provisionar o ambiente de staging

Projeto Railway staging, branch Neon staging, Redis Upstash staging, bucket R2 staging e 6
segredos no GitHub Actions. Você fornece as credenciais; o resto é automatizável.
Runbook: `docs/operations/s61/STAGING_SETUP_RUNBOOK.md`.

---

## Bloqueadas — não são suas ainda

| Tarefa                                                 | Bloqueada por                                      |
| ------------------------------------------------------ | -------------------------------------------------- |
| Smoke E2E do WhatsApp                                  | diagnóstico do dashboard, em aberto no Claude Code |
| Compra real de uma assinatura (checkout ponta a ponta) | tarefas 2 e 3 desta fila                           |
| Confirmar traces no Axiom                              | Claude Code precisa confirmar o deploy primeiro    |

---

## O que **não** é sua tarefa

Registrado para você não se sentir responsável por isso: os 132 erros de tipo nos testes, o
bundle do frontend, os 12 PRs do Dependabot, a cobertura de testes e o diagnóstico do
dashboard são todos do Claude Code. Nenhum deles precisa de você além de decidir prioridade,
quando perguntado.
