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

### ❌ CANCELADA — Tarefa 4: Twilio, habilitar o WhatsApp Sender

> **Cancelada em 03/08 (S88), não desbloqueada.** A investigação terminou e o caminho deixou
> de existir: a Twilio não suporta coexistência, e o requisito do Pedro exige coexistência.
> Substituída pela **tarefa 13**. Evidência em `docs/operations/s86/WHATSAPP_MULTITENANT.md`
> §7 e decisão formal em [`docs/adr/016-whatsapp-cloud-api-coexistence.md`](../adr/016-whatsapp-cloud-api-coexistence.md).
>
> Resumo do porquê: a documentação da Twilio manda **apagar a conta do WhatsApp** do número
> antes de registrá-lo como sender. O cliente perderia o número no celular — exatamente o que
> o requisito proíbe.
>
> O texto original fica abaixo como registro histórico.

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

| #   | Provedor   | Login é o e-mail?      | Exige senha para trocar? | De quem é  | Estado   |
| --- | ---------- | ---------------------- | ------------------------ | ---------- | -------- |
| 5a  | Railway    | Não (login via GitHub) | Não                      | assistente | ✅ 03/08 |
| 5b  | Cloudflare | **Sim**                | **Sim**                  | Pedro      | ✅ 03/08 |
| 5c  | Upstash    | sim                    | não (código por e-mail)  | Pedro      | ✅ 03/08 |

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

**5c — Upstash.** Inspecionado em 03/08, em `console.upstash.com/account/settings`:

| Campo                       | Valor                                               |
| --------------------------- | --------------------------------------------------- |
| Account Email Address       | `leme.baseapr@gmail.com`, com botão `Change Email`  |
| Multi-Factor Authentication | **desligado**                                       |
| Transactional Emails        | ligado ("usage limit exceeds and team invitations") |
| Marketing Emails            | ligado                                              |

Não há campo de cobrança separado como na Cloudflare: o `Account Email Address` é o
endereço único, então trocá-lo resolve identidade e avisos de uma vez. O assistente clicou
em `Change Email` três vezes e o diálogo não abriu — o console entrou em estado
inconsistente (tela em branco, renderizador travando o CDP). Sem diagnóstico conclusivo se
é bug do console ou artefato da automação. Passa para o Pedro, que executa no navegador
dele sem intermediação.

**5c concluída em 03/08.** Pedro trocou o `Account Email Address` para
`pedro.perin@theiadvisor.com` e confirmou pelo código enviado por e-mail (Upstash usa
código de verificação, não link). A troca **derruba a sessão** — comportamento esperado,
não falha.

**Forma correta de entrar nessa conta, a partir de agora:** `Continue with Google` com
`pedro.perin@theiadvisor.com`. Verificado no painel: é a **mesma** conta, não uma nova.
Evidência: `saas-ai-sales-cache` (`casual-meerkat`, AWS SA-EAST-1, Free Tier) presente e
ativo, mais o `huge-turkey` marcado `DELETED` — o banco antigo, de antes da recriação de
S84.

A produção nunca dependeu disso: o backend fala com o Redis por `REDIS_URL` e token, não
pela sessão do console.

**5c-iii — MFA da Upstash ligada** (Pedro, 03/08). Puxada da tarefa 7 para aproveitar a
sessão aberta. Painel confirma o interruptor verde e
`Account Email Address: pedro.perin@theiadvisor.com`. Código de backup exibido e guardado.

**Continua aberto:** 2FA `Inactive` na Cloudflare — mas ver a ressalva sobre SSO na
tarefa 7.

### ✅ Tarefa 6 — Rotacionar as credenciais expostas — CONCLUÍDA 03/08 (S87)

O token do R2 (escopo: bucket de backups) e o usuário `neondb_owner` (escopo: **total sobre
o banco de produção**) trafegaram por captura de tela em sessão anterior. O risco foi aceito
com gatilho explícito: **antes do primeiro cliente pagante**.

Inclui também marcar `CLERK_SECRET_KEY` como "Sensitive" na Vercel — hoje qualquer pessoa
com acesso ao projeto lê o valor. **Atenção:** rotacionar a chave do Clerk sem coordenar
derruba o login do site. Essa parte precisa ser feita junto com o Claude Code.

#### 6a — Token do R2 ✅ CONCLUÍDA 03/08 (S87)

Token novo criado no Cloudflare com o mesmo escopo (`theiadvisor-backups`, Object Read &
Write), segredos `R2_BACKUP_ACCESS_KEY_ID` e `R2_BACKUP_SECRET_ACCESS_KEY` atualizados no
GitHub Actions, e só então o token `github-actions-backup` de 31/07 revogado — nessa ordem,
nunca a inversa.

**Evidência:** backup run #101 passou com os segredos novos e o token antigo ainda vivo;
run #102 passou **depois** da revogação (`Uploaded postgres/2026-08-03/...T20-11-18Z.dump`,
`toc_rows=438`). Só a credencial nova explica o segundo.

**Conta correta do Cloudflare**, para não se perder de novo: `Leme.baseapr@gmail.com's
Account`, ID `790e7ded8031bec32fb92bbce27fa76e` — é a que tem os dois buckets e o domínio. A
entrada `Pedro.perin@theiadvisor.com's Account` é uma conta vazia que a Cloudflare criou
sozinha quando o convite de S86 foi aceito. O rótulo da conta é cosmético; o `Billing email`
já é institucional desde 5b-iv.

#### 6b — `neondb_owner` ✅ CONCLUÍDA 03/08 (S87), com retrabalho

Senha resetada no Neon (projeto `sales-ai`, branch `production` `br-steep-glade-acqrg6s5`),
e a connection string nova aplicada em **dois** consumidores: `DATABASE_URL` na Railway e
`DATABASE_URL_BACKUP_RO` no GitHub Actions.

**Evidência final:** `/health` com `status: ok` + `database: ok` e uptime baixo (réplica
nova); backup run #104 `success` (`toc_rows=438`,
`Uploaded postgres/2026-08-03/...T21-28-09Z.dump`).

**Três achados desta tarefa, todos registrados como lição:**

1. **A Railway não aplica variável ao salvar.** A mudança fica em rascunho, com um aviso
   `Apply 1 change` / `Deploy` no topo. Salvar sem clicar em `Deploy` deixa o processo
   antigo rodando com a credencial morta — foi o que tirou a API do ar por ~13 minutos, com
   `Can't reach database server` no `/health` enquanto o `uptime` seguia crescendo (sinal
   de que **não houve** restart). `uptime` alto + erro de banco = variável não aplicada.
2. **`DATABASE_URL_BACKUP_RO` é o mesmo `neondb_owner`.** O painel do Neon lista **um único
   role** na branch. O sufixo `_RO` é ficção: o backup noturno roda com privilégio total
   sobre a produção. Dívida registrada — criar um role realmente somente-leitura para o
   `pg_dump` é tarefa própria, não foi feita aqui.
3. **A rotação precisou ser feita duas vezes.** Na primeira, o assistente leu o texto da
   página do Neon para checar o `/health` depois de uma navegação que caiu na aba errada; o
   botão `Show password` estava ligado e a senha em claro entrou na conversa. Mesma classe
   de exposição que esta tarefa existe para eliminar, logo a única saída coerente era
   repetir o ciclo. **Regra que fica:** não ler página de painel que possa conter segredo —
   nem por texto, nem por captura — e conferir a aba antes de extrair conteúdo.

#### 6c — `CLERK_SECRET_KEY` como "Sensitive" na Vercel ✅ CONCLUÍDA 03/08 (S87)

**Evidência:** a lista em `Settings → Environment Variables` do projeto
`saas-ai-sales-assistant-oc6b` mostra `CLERK_SECRET_KEY` com tipo **`Sensitive`**, o selo
`Needs Attention` sumiu, e o valor deixou de ser exibido. `theiadvisor.com/sign-in` renderiza
o widget do Clerk normalmente depois do redeploy — login intacto.

**Pré-condição que não era óbvia:** a Vercel recusa marcar como Sensitive qualquer variável
que valha para o ambiente **Development** ("Sensitive variables cannot target Development").
Foi preciso desmarcar `Development` e manter `Production` + `Preview`. Perda operacional
nenhuma: `Development` só alimenta `vercel dev`, que este projeto não usa.

**Armadilha, registrada para não cair de novo:** o selo `Needs Attention` abre um balão cujo
único botão é **`Rotate Variable`** — que inicia a troca da chave do Clerk, não a marcação
como Sensitive. Clicar ali sem coordenar derruba o login. O caminho certo é `...` → `Edit`.

##### Risco aceito — chave do Clerk exposta em canal de trabalho

**Data:** 2026-08-03 (S87) · **Decisão:** Pedro Leme Perin · **Status:** aceito, não mitigado

Durante esta tarefa o valor de `CLERK_SECRET_KEY` (chave `sk_live_`) apareceu por inteiro numa
captura de tela enviada ao canal de trabalho — o campo Value da tela de edição da Vercel mostra
o segredo em texto limpo, e a instrução do assistente foi justamente abrir essa tela.

| Credencial                | Alcance                                                                                           | Rotacionada? |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------ |
| `CLERK_SECRET_KEY` (live) | Autenticação do produto — API de servidor do Clerk, emissão de sessão em nome de qualquer usuário | Não          |

Recomendação técnica: rotacionar. Decisão registrada: **manter**, pelo custo de interrupção —
a troca derruba o login enquanto não estiver aplicada em Vercel **e** Railway, e não há cliente
ainda. Mesma forma da decisão de 31/07 em `CLAUDE.md` §4.3, aplicada a um segredo de classe
maior.

**Gatilho para revisão obrigatória:** antes do primeiro cliente pagante — junto com as demais
credenciais sob o mesmo gatilho.

**Causa raiz, e ela é do método, não do Pedro:** a sessão inteira operou pedindo que ele
mostrasse telas de painel. Três segredos vazaram em um dia por três formatos diferentes
(arquivo `.png` na pasta, texto de página lido pelo assistente, captura de tela enviada ao
chat). Nenhum deles foi descuido isolado — todos foram o fluxo de trabalho funcionando como
desenhado.

**Regra que passa a valer:** o assistente não pede captura de tela de painel. Quando precisar
saber o que a tela mostra, abre pelo navegador e lê sozinho, evitando campos de valor, ou pede
**descrição em palavras**. Telas com campo de segredo visível — `Value` da Vercel, `Connect` do
Neon com `Show password`, tela de criação de token — não são lidas nem capturadas em hipótese
alguma.

### Tarefa 7 — 2FA com redundância nas demais contas

> **Reformulada em 03/08, por levantamento no painel.** A pergunta certa não é "essa conta
> tem 2FA?", e sim "**quem autentica essa conta?**". Metade da infraestrutura entra por SSO,
> e nesses casos o segundo fator que importa é o do provedor de identidade, não o do serviço.

| Conta      | Como se entra                         | Onde o 2FA precisa estar | Estado em 03/08                                                      |
| ---------- | ------------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| Upstash    | e-mail + Google                       | na própria Upstash       | ✅ MFA ligada, backup guardado                                       |
| Cloudflare | Google SSO (`leme.baseapr@gmail.com`) | **na conta Google**      | 2FA da Cloudflare `Inactive`, mas a conta Google tem chave de acesso |
| Railway    | OAuth do GitHub                       | **no GitHub**            | ✅ herda o 2FA do GitHub, ligado em 03/08                            |
| GitHub     | senha + Google                        | no GitHub                | ✅ 03/08 — app autenticador `Configured` + códigos de recuperação    |
| Stripe     | e-mail institucional                  | na Stripe                | ✅ blindado em 01/08                                                 |

**O elo mais fraco é o GitHub, e por margem larga.** Ele acumula três papéis: guarda o
código-fonte, é o provedor de identidade da Railway (portanto do backend em produção), e a
partir de S86 guarda o token de push do sandbox do Cowork. Hoje tem senha, **nenhuma
passkey** e **nenhum segundo fator**. Quem obtivesse essa senha levaria o repositório e a
infraestrutura de uma vez.

**Fechado em 03/08.** App autenticador como método preferido, códigos de recuperação
exibidos e guardados.

**As duas contas Google, inspecionadas em 03/08 — e o resultado é o inverso do esperado.**

|                            | `leme.baseapr@gmail.com` (pessoal) | `pedro.perin@theiadvisor.com` (institucional) |
| -------------------------- | ---------------------------------- | --------------------------------------------- |
| Verificação em duas etapas | **Ativada desde 06/07/2022**       | 🔴 **"está desativada"**                      |
| Chaves de acesso           | 2                                  | nenhuma                                       |
| Telefone de recuperação    | (16) 98858-3222                    | (16) 98858-3222                               |
| E-mail de recuperação      | `pedroperin@yahoo.com.br`          | `leme.baseapr@gmail.com`                      |
| Códigos de backup          | não configurados                   | não configurados                              |
| Senha alterada em          | 11/05/2021                         | 02/06/2026                                    |

**A conta pessoal está bem protegida. A conta que carrega o negócio, não.**

`pedro.perin@theiadvisor.com` é hoje: o login da Stripe (as duas contas), o login da Upstash
via Google, um Super Administrator da Cloudflare, e o destinatário de toda a cobrança e
renovação que acabamos de migrar para lá. Os apps vinculados confirmam: `Cloudflare
Dashboard`, `Upstash`, `Claude for Gmail`.

Consequência que anula trabalho anterior: o 2FA da Stripe blindado em 01/08 tem como flanco
a redefinição de senha por e-mail — e esse e-mail chega numa caixa sem segundo fator. O
alerta de 01/08 registrado na tarefa 1 ("o problema seria o e-mail, não o fator de
autenticação") estava certo, e continuou verdadeiro por mais dois dias sem ninguém olhar.

Único atenuante real: a MFA própria da Upstash, ligada hoje, bloqueia o caminho por lá
mesmo se o Google cair.

**Fechado em 03/08, 16h00 BRT.** Painel de `pedro.perin@theiadvisor.com` agora exibe:
`Verificação em duas etapas — Ativada desde 16:00`, `1 chave de acesso`,
`Google Authenticator — Adicionado: 15:59`, `Códigos de backup — 10 códigos disponíveis`,
e-mail de recuperação `leme.baseapr@gmail.com`. O banner voltou a
"Sua conta está protegida — nenhuma ação recomendada".

Nota, em pt-BR o Google chama os códigos de backup de **"Códigos alternativos"** na tela de
verificação em duas etapas, e de "Códigos de backup" na tela de segurança. Os dois nomes, o
mesmo recurso — foi o que travou a execução por uma rodada.

### ✅ Tarefa 7 — CONCLUÍDA em 03/08

Resíduo consciente, não bloqueante: `leme.baseapr@gmail.com` continua sem códigos de backup.
Ela tem 2FA desde 2022, duas chaves de acesso, telefone e e-mail de recuperação próprios, e
não autentica nada crítico além da Cloudflare — que agora tem uma segunda via institucional.
Fica registrado, sem virar tarefa.

> **Risco operacional recorrente, registrado em 03/08.** Duas vezes no mesmo dia um segredo
> foi salvo em texto puro **dentro da pasta do projeto** — `TOKEN GITHUB COWORK-SANDBOX.txt`
> e `CÓDIGO DE BACKUP UPSTASH.txt`. O repositório é **público**. Nenhum dos dois chegou a
> ser versionado (verificado com `git log --diff-filter=A` em todo o histórico), e ambos
> estão no `.gitignore`, junto com padrões defensivos amplos (`*BACKUP*.txt`, `*CÓDIGO*.txt`,
> `*SENHA*.txt`, `*RECOVERY*.txt`, `*.key`, `*.pem`).
> O `.gitignore` é rede, não solução: o lugar de um código de recuperação é o gerenciador de
> senhas, ou papel, fora de qualquer pasta versionada.

Railway, Cloudflare, Neon, Upstash, GitHub, Google Workspace. Mesmo padrão da Stripe: dois
fatores independentes mais código de recuperação guardado fora do computador.

### ▶ ATIVA — Tarefa 14: falar com a 360dialog (comercial)

**Criada em 04/08 (S89), pela decisão do ADR-017.** Assume a frente da fila; a tarefa 13 sai
do caminho crítico.

**O que decidiu isso.** A investigação de S89 achou o que o ADR-016 não tinha custeado: um
Solution Partner da Meta permite integrar **até 3 números de cliente sem conta de
desenvolvedor da Meta** — sem App Review, sem verificação de empresa da TheIAdvisor, sem o
antifraude que travou ontem. Custo: €250/mês, sem fidelidade. Análise completa em
[`docs/operations/s89/WHATSAPP_BSP_COST_ANALYSIS.md`](s89/WHATSAPP_BSP_COST_ANALYSIS.md).

**O que esta tarefa NÃO é:** não é abrir conta, não é pagar, não é cadastrar cartão. É uma
conversa comercial, de graça, para responder uma pergunta antes de qualquer dinheiro sair.

**Por que a pergunta importa:** a documentação da 360dialog se contradiz. Duas páginas dizem
que o registro como Meta Tech Provider só é exigido acima de 3 números; uma terceira lista o
registro entre os pré-requisitos de abertura de conta. Se a terceira estiver certa, a
vantagem inteira desta rota some e a decisão volta à mesa.

**Passos, nesta ordem:**

1. Abrir `https://start.360dialog.com/connect`
2. Preencher com os dados da TheIAdvisor (CNPJ 67.084.607/0001-78, site
   `https://theiadvisor.com`, e-mail `pedro.perin@theiadvisor.com`)
3. No campo de mensagem, colar exatamente:

   > We are a Brazilian SaaS (sales assistant with AI) preparing to add WhatsApp for our
   > customers. Our product requirement is Coexistence: the customer keeps using their own
   > number on the WhatsApp Business app while our platform sends and receives via Cloud API.
   >
   > Three questions before we sign up:
   >
   > 1. Is Meta Tech Provider registration required to open a Partner Hub account, or only to
   >    onboard more than 3 numbers? Your documentation is contradictory on this point.
   > 2. Is Coexistence onboarding available for Brazilian phone numbers today?
   > 3. On the Starter plan, is the per-channel licence fee €25 or €49?

4. Enviar e reportar a resposta

**Como saber que terminou:** a 360dialog responde as três perguntas. Aí eu decido se a rota
se confirma ou se volta à mesa.

**Não faça ainda:** abrir a conta de parceiro. Ativar o Partner Hub inicia a cobrança no ato,
e não há o que testar antes de eu implementar. Isso vira tarefa própria.

### Tarefa 13 — Meta, conta de desenvolvedor — ⏸️ ADIADA em 04/08 (S89)

> **Sai do caminho crítico pelo ADR-017.** Não está cancelada: o registro no Tech Provider
> Program volta a ser exigido no **4º cliente**. Até lá, a 360dialog cobre.
>
> Efeito colateral desejado: a conta do Facebook ganha o descanso que o antifraude pedia
> (lição #91), e quando o cadastro for retomado haverá receita entrando e um canal de
> escalonamento com a Meta via 360dialog — nenhum dos dois existe hoje.
>
> O registro histórico e o andamento de 03/08 ficam abaixo, intactos.

#### Registro histórico — Tarefa 13: Meta, criar o portfólio empresarial e verificar a empresa

**Criada em 03/08 (S88), pela decisão do ADR-016.** Substitui a tarefa 4.

**Por que está à frente da 8:** a verificação de empresa na Meta leva **semanas**. É o item
de maior latência do projeto depois da Stripe, e as duas correm em paralelo. Tudo do canal
WhatsApp — Tech Provider Program, Embedded Signup, coexistência — depende dela.

**Documentos:** os mesmos já usados na Stripe — cartão CNPJ, contrato social, comprovante de
endereço da empresa.

**Pré-requisito que não é óbvio:** o portfólio empresarial da Meta se cria a partir de uma
**conta pessoal do Facebook**. Não existe cadastro empresarial independente.

**Primeiro passo, e só ele:** entrar em `https://business.facebook.com/` e reportar o que
aparece. O assistente conduz os passos seguintes um a um.

#### Andamento em 03/08 (S88)

| Passo                          | Estado                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Portfólio empresarial existe   | ✅ **The IAdvisor**, ID `1593609525024955`, criado em 26/02/2026                                                        |
| Dados da empresa preenchidos   | ✅ razão social, endereço com CEP, telefone e site — conferidos no painel                                               |
| E-mail de contato do portfólio | ✅ era `pedro.perin@hotmail.com` **com confirmação pendente** → trocado para `pedro.perin@theiadvisor.com` e confirmado |
| Verificação de empresa         | ⛔ **não disponível ainda** — ver achado abaixo                                                                         |
| Conta de desenvolvedor da Meta | ⛔ **travada no SMS** — ver bloqueio abaixo                                                                             |

**Achado que inverte a ordem prevista.** A Central de Segurança do portfólio diz, textualmente:
_"Verificação para The IAdvisor — Sua organização não precisa ser verificada."_ A verificação
de empresa **não abre com o portfólio sozinho**; ela fica disponível depois que existe um app
da Meta com o produto WhatsApp vinculado. O FAQ do Tech Provider Program da Twilio descreve o
mesmo caso e dá a mesma saída: _"Create a Meta app, add the WhatsApp product, and submit
business verification."_

Ordem correta, portanto: **conta de desenvolvedor → app → produto WhatsApp → verificação**.

**Bloqueio ativo (03/08, 20h30 BRT):** o cadastro de conta de desenvolvedor
(`developers.facebook.com`) exige confirmação por SMS e o código **não chega** em
`+55 16 98858-3222`. Reenvio tentado. O diálogo só oferece "Enviar SMS novamente" e "Atualizar
número de celular" — não há verificação por ligação nem por e-mail. Pedro não tem segundo
número. Causa provável: filtro de operadora brasileira sobre o remetente da Meta, que costuma
soltar sozinho em algumas horas.

**Desdobramento no fim da noite de 03/08 — o bloqueio tem três camadas, não uma:**

1. O SMS **chegou**; estava na pasta de spam do aparelho. Código aceito.
2. Em seguida a Meta recusou por outro motivo: o dispositivo/conta "precisa ser mais
   utilizado". É o portão antifraude sobre conta de Facebook com pouco histórico — não tem
   relação com o aparelho nem com o navegador.
3. Tentativas seguintes passaram a devolver **"ocorreu um erro, tente novamente" em laço**,
   inclusive ao tentar ligar a verificação em duas etapas pelo app. Comportamento típico de
   escalonamento do antifraude depois de várias tentativas seguidas na mesma conta.

**Sessão encerrada nesse ponto, por decisão do assistente.** Insistir reforça o bloqueio.

**Plano de retomada:** deixar a conta em paz por pelo menos um dia. Antes de tentar de novo,
a próxima sessão precisa resolver uma pergunta que pode tornar este cadastro **desnecessário**
— contratar um BSP que já seja Solution Partner da Meta com coexistência elimina a exigência
de conta de desenvolvedor. Ver `docs/operations/s89-next-session-prompt.md`.

#### Segurança do portfólio — registrado, sem virar tarefa ainda

Levantado na Central de Segurança em 03/08, para tratar depois da verificação:

- Exigência de autenticação de dois fatores no portfólio: **"Ninguém"**.
- Exigência de passkey: **"Ninguém"**, com alerta `1 usuário without passkey enabled`.
- **Pedro é o único administrador** — a própria Meta recomenda um segundo.
- Nenhum domínio confiável cadastrado.

### ✅ Tarefa 15 — Twilio: migrar o login para o e-mail institucional — CONCLUÍDA 03/08 (S89)

**Lacuna descoberta por acaso**, ao abrir o console para a tarefa 8. A tarefa 5 migrou
Railway, Cloudflare e Upstash — **a Twilio nunca entrou na lista**. Continuava sob
`leme.baseapr@gmail.com`, sendo o canal de **voz em produção**. Mesma causa raiz do incidente
de junho, viva por mais dois meses depois de a tarefa 5 ter sido dada por concluída.

Trocado para `pedro.perin@theiadvisor.com` em `User Settings → Personal information →
Edit email address`, com código de verificação enviado ao endereço novo.

**Ordem importou:** feito **antes** de submeter o bundle regulatório, porque a Twilio avisa
aprovação e recusa por e-mail. Trocar depois do envio arriscava perder o aviso na transição.

**Consequência:** o login da Twilio agora **é** `pedro.perin@theiadvisor.com`. O e-mail
pessoal deixou de funcionar como usuário.

A produção nunca dependeu disso — o backend fala com a Twilio por `TWILIO_ACCOUNT_SID` e
`TWILIO_AUTH_TOKEN`, não pela sessão do console.

> **Ainda em aberto, e não virou tarefa:** ninguém auditou o resto. Neon, Vercel, Sentry,
> Resend, Deepgram, OpenAI e Anthropic **não foram verificados** — a tarefa 5 tratou três
> provedores e a lista nunca foi fechada. Vale uma varredura antes do primeiro cliente.

### ⏰ LEMBRETE COM GATILHO — religar a recarga automática da Twilio

**Desligada em 06/08/2026 (S90), por decisão do Pedro, com data de retorno em aberto.**

**Estado atual da conta Twilio:**

| Item                   | Valor                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| Saldo                  | $9,67 (congelado desde 02/08)                                      |
| Gasto mensal hoje      | ~$1,15 — só a assinatura do número americano                       |
| Gasto após o número BR | ~$5,40/mês                                                         |
| Recarga automática     | **DESLIGADA**                                                      |
| Config anterior        | gatilho em $10, recarregar até $50 → cobrança de **$40,33**        |
| Cartão                 | Visa final 2414, val. 02/2031 — **recusado pelo emissor** em 02/08 |

**Por que foi desligada.** O gasto é fixo e previsível em pré-lançamento. A automática só
serviria para tentar de novo a cobrança que o banco recusa, e **cada recusa piora a reputação
do cartão no antifraude do emissor**. Sem clientes, não há gasto variável a proteger.

**RELIGAR QUANDO QUALQUER UM DESTES ACONTECER — o que vier primeiro:**

1. **Primeiro cliente real fizer a primeira ligação.** É o gatilho principal. A partir daí o
   gasto vira variável, um dia de uso intenso pode consumir em horas o que hoje leva um mês, e
   saldo zerado **faz a Twilio liberar os números** — o canal cai no meio do expediente e o
   número brasileiro pode ser perdido para outro cliente da Twilio.
2. **Saldo cair abaixo de $5.**
3. **Qualquer teste de carga** que gere volume real de chamadas.

**Como religar, quando for a hora:** `console.twilio.com/us1/billing/manage-billing/payment-settings`
→ aba `Auto Recharge`. Sugestão de configuração, mais baixa que a anterior: gatilho em **$10**,
recarregar até **$25**. A cobrança cai de $40 para ~$15 — valor menos sujeito a recusa por
antifraude, e ainda assim ~4 meses de folga.

**Pré-condição para religar:** o cartão precisa estar funcionando. Ver bloco abaixo.

**Enquanto estiver desligada:** configurar `Balance Notifications` (aba ao lado) para avisar
saldo baixo. Sem isso, nada avisa que o saldo acabou.

### 💳 Pendência — cartão da Twilio recusado pelo emissor

Em 02/08 a Twilio tentou cobrar $40,33 e o **banco emissor recusou**. O cartão não está
vencido (val. 02/2031) e segue cadastrado como método principal. A Twilio nunca informa o
motivo — quem recusa é o emissor.

Causas prováveis, não verificadas: antifraude do banco sobre compra internacional, limite
indisponível no momento, ou função de compra internacional desabilitada.

**Não é urgente hoje** — com $9,67 e a automática desligada, nada quebra. Vira urgente quando
a recarga tiver de voltar.

**Duas saídas, a decidir quando chegar a hora:**

1. Autorizar a compra internacional no app do banco e testar com recarga manual.
2. **Trocar pelo cartão da conta Inter PJ.** Resolve a recusa e também a coerência contábil —
   despesa da empresa no cartão da empresa. Hoje a Twilio está no cartão pessoal do Pedro com
   endereço da empresa, o que o contador vai questionar.

### 🕐 Tarefa 8 — Twilio, número brasileiro — BUNDLE ENVIADO 03/08 (S89), aguardando análise

**Estado verificado no painel, não inferido:**

| Campo    | Valor                                         |
| -------- | --------------------------------------------- |
| Nome     | `TheIAdvisor - BR Local - Voz`                |
| SID      | `BU610d433afc68938b42d7d06b29de2bdb`          |
| País     | Brazil                                        |
| Tipo     | Local - Business                              |
| Status   | ✅ **APROVADO** — "Aceito" na pág. de detalhe |
| Enviado  | 03/08/2026 ~23h30 BRT                         |
| Aprovado | **04/08/2026 19:48**                          |

> ⚠️ **A LISTA de bundles mostrou `Sent for review` por dois dias depois da aprovação.** Só a
> **página de detalhe** do bundle diz "Aceito", e o e-mail de
> `numbers-regulatory-review@twilio.com` confirma. **Conferir sempre o detalhe, nunca a
> listagem** — em S90 isso quase levou à conclusão errada de que o prazo tinha estourado.

**Aviso chegou em:** `pedro.perin@theiadvisor.com`. A migração da tarefa 15, feita horas antes
do envio, funcionou exatamente como planejado (lição #99).

**Número disponível, verificado em 06/08:** `+55 16 2398 0155`, Ribeirão Preto/SP, **só Voz**,
**$4,25/mês**. Havia **apenas um** número na busca. Ausência de SMS é o esperado — número fixo
brasileiro não faz SMS por regra da Anatel, e o produto usa esse número para ligações.

**Ainda NÃO comprado, de propósito.** O custo real ($4,25 contra a estimativa de $1–2) leva o
gasto total a ~$5,40/mês. Com saldo de $9,67 e o cartão recusando, são menos de 2 meses de
folga — e saldo zerado faz a Twilio **liberar os números**. Perder um número BR já divulgado a
cliente é pior do que ainda não tê-lo. Ver os dois blocos acima.

**Escolhas feitas, e por quê:**

- **Direct Customer**, não ISV. Hoje o número é da TheIAdvisor — testes, demonstração e o
  primeiro piloto operado pelo próprio Pedro. Quando o produto passar a provisionar um número
  por cliente, vira ISV e o bundle será refeito — mas nesse momento a arquitetura de números
  por inquilino também muda, então o retrabalho aconteceria de qualquer forma.
- **CNPJ Certificate nos dois campos** (identidade e endereço). Resolveu o risco previsto de o
  comprovante de endereço estar no CPF do Pedro e ser recusado: o cartão CNPJ é documento
  oficial da Receita, no nome da empresa, e traz o endereço. Emitido novo na hora, para não
  entregar documento antigo à análise de compliance.
- **Status callback URL vazio.** É webhook para a aplicação receber o resultado. Não há
  endpoint e não vale construir por um bundle só.

**Depois da aprovação:** aí sim comprar o número. Comprar antes trava.

> **Achado colateral, sem urgência:** a conta da Twilio se chama **"My first Twilio account"**,
> o nome padrão nunca trocado. Cosmético, mas aparece em faturas e comunicações.

### Registro original da tarefa 8

A conta tem exatamente um número ativo, `+1 507 763 4719`, americano.

**Desbloqueada em 03/08 (S88).** A ressalva de escopo caiu: o número é do canal de **voz**,
que continua na Twilio independentemente da decisão do WhatsApp (ADR-016). Não há retrabalho
a temer.

**Fato novo levantado em S88, que muda a estimativa:** número local brasileiro na Twilio não
é compra de um clique. Exige **regulatory bundle** — CNPJ mais comprovante de endereço no
Brasil — com análise de até 2 dias úteis. Pessoa física não pode adquirir número local no
Brasil; a PJ pode. Custo de assinatura segue baixo (ordem de US$ 1 a 2/mês mais uso).

### ⏸️ Tarefa 16 — Auditoria de identidade dos provedores restantes — INICIADA 03/08 (S89)

**Origem:** lacuna descoberta na tarefa 15. A tarefa 5 tratou três provedores (Railway,
Cloudflare, Upstash) e **a lista nunca foi fechada**. A Twilio ficou dois meses de fora sendo
o canal de voz em produção. Restam sete.

| Provedor  | O que está atrás dele               | Auditado? | E-mail             |
| --------- | ----------------------------------- | --------- | ------------------ |
| Neon      | **banco de produção**               | ✅ 03/08  | ⛔ ainda o pessoal |
| Vercel    | frontend em produção                | ❌        | —                  |
| Resend    | remetente de todo e-mail do produto | ❌        | —                  |
| Sentry    | telemetria de erro                  | ❌        | —                  |
| Deepgram  | transcrição                         | ❌        | —                  |
| OpenAI    | sugestões de IA                     | ❌        | —                  |
| Anthropic | provider de fallback                | ❌        | —                  |

#### 16a — Neon: **tentativa falhou, parada por decisão do assistente**

**Estado levantado (03/08, ~23h40):**

| Campo            | Valor                                               |
| ---------------- | --------------------------------------------------- |
| E-mail da conta  | `leme.baseapr@gmail.com` — **não mudou**            |
| Formas de entrar | Google (pessoal) **e** GitHub (`@pedro-leme-perin`) |
| Senha            | **criada nesta sessão** — antes a conta era só SSO  |
| Two-factor auth  | existe na interface, **não verificado**             |

**O que aconteceu:** `Change email` preenchido com o endereço institucional → o Neon pediu
criação de senha → mandou link de confirmação → **o link expirou antes do clique**.

**Efeito observado enquanto a troca fica pendente:** a barra lateral perde `Password`,
`Two-factor auth` e `Passkeys`, e o campo de e-mail fica somente-leitura sem o link
`Change email`. Comparação entre duas leituras do painel na mesma sessão. Não é falha — é o
console travando alterações de identidade enquanto há confirmação em aberto. **Confiança
média**, inferido do comportamento, não documentado.

**Por que parou aqui, e a decisão foi do assistente:** é o banco de produção, o único ativo
cujo acesso perdido não tem volta; a sessão já durava horas; o painel estava em estado não
compreendido por inteiro; e **não há urgência** — a conta é Free Tier, sem cobrança nem
renovação a vencer. Aplicação da lição #91 a outro fornecedor: insistir sobre estado que não
se entende piora a posição.

**Produção nunca esteve em risco:** o backend fala com o banco por `DATABASE_URL`, não pela
sessão do console.

**Como retomar, em dois minutos:** pedir a troca de e-mail e **clicar no link imediatamente**,
sem intervalo. O erro foi o tempo entre pedir e clicar.

**Pendência do Pedro antes de qualquer retomada:** a senha nova do Neon precisa estar no
gerenciador de senhas, junto da nota de que o login também funciona por Google pessoal e por
GitHub.

### Tarefa 9 — NFS-e com o contador

**Passo zero concluído em 03/08 (S89): o portal está liberado e a empresa pode emitir.**
Verificado por leitura direta do painel, não por suposição.

| Item                       | Estado no painel em 03/08/2026 22h                                         |
| -------------------------- | -------------------------------------------------------------------------- |
| Acesso ao ISSnetOnline     | ✅ senha inicial trocada, login funcionando                                |
| Status do contribuinte     | **Ativo**                                                                  |
| Regime                     | **Optante pelo Simples Nacional**                                          |
| Competência corrente       | Julho 2026                                                                 |
| DTE (Domicílio Tributário) | ✅ credenciado — contatos: `pedro.perin@theiadvisor.com` + (16) 98858-3222 |
| Caixa de entrada do DTE    | **vazia** — nenhuma intimação pendente                                     |
| Menu de emissão            | ✅ **Nova Nota Eletrônica** disponível                                     |
| Pendências / débitos       | **nenhuma** listada                                                        |

> ⚠️ **Correção de fato.** O painel mostra **Inscrição Municipal `20948168`**. A documentação
> registrava `67084607000178` desde S81 — que é o CNPJ sem pontuação, anotado com a
> justificativa "padrão Ribeirão Preto atribui IM igual ao CNPJ". Era suposição, nunca lida
> na fonte, e se propagou por `CLAUDE.md`, `CHANGELOG.md`, `PROJECT_HISTORY.md` e os docs de
> S81. Corrigido em `CLAUDE.md`; os históricos ficam como registro.

**O que resta, e agora é só isso:** falar com o contador para definir o enquadramento do
serviço na emissão — código de atividade municipal, alíquota de ISS, e o novo par exigido
pela atualização de 2026 (Código Tributário Nacional + NBS, Nomenclatura Brasileira de
Serviços). Errar o código na primeira nota é retrabalho com a prefeitura.

**Risco se ignorado:** cobrar sem emitir nota é irregularidade fiscal.

**Endereço do portal:** `https://www.issnetonline.com.br/ribeiraopreto/online/login/login.aspx`
**Suporte do sistema:** `suporte.ribeiraopreto@notacontrol.com.br`

> **Consequência do DTE que vale lembrar:** a partir de 03/08 a prefeitura notifica por meio
> eletrônico **com efeito legal** (LC 3.059/2021, IN 3/2023-FAZ-S). Prazo de intimação corre
> a partir da entrega, lida ou não. A caixa a acompanhar é a do DTE dentro do portal, não o
> e-mail — o e-mail é só o aviso.

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
