# T2 — Conta Inter PJ (runbook manual)

**Status**: Cowork não pode automatizar (Kaspersky Safe Money intercepta + onboarding bancário multi-fator que excede MCP capabilities).
**Tempo estimado**: 30-60 min execução + 1-2 dias úteis aprovação.
**Pré-requisitos**: CNPJ ativo (T1-independent, mas T3 Stripe payout depende disto).

---

## Por que Inter PJ?

| Critério            | Inter PJ                  | Alternativas           |
| ------------------- | ------------------------- | ---------------------- |
| Tarifa mensal       | **R$ 0**                  | Itaú/BB: R$ 39-119     |
| TED/PIX PJ          | **R$ 0 ilimitado**        | Maioria: R$ 10-15 cada |
| Cobrança por boleto | **R$ 1,99**               | Itaú: R$ 3,90          |
| Integração Stripe   | Nativa (chaves PIX CNPJ)  | Todos suportam         |
| Onboarding          | 100% digital (app/web)    | Maioria exige agência  |
| Conta poupança PJ   | Sim (rendimento CDI 100%) | Variável               |

**Decisão arquitetural**: Inter PJ. Zero tarifa fixa preserva margem de SaaS B2B no
estágio pre-launch (faturamento previsto <R$10k/mês primeiros 6 meses).

---

## Documentos necessários

| Documento                                  | Onde obter                                                    |
| ------------------------------------------ | ------------------------------------------------------------- |
| **CNPJ ativo**                             | Comprovante via solucoes.receita.fazenda.gov.br → Cartão CNPJ |
| **Contrato Social SLU**                    | PDF do REDESIM (protocolo SPP2630711235) — Pedro tem          |
| **RG sócio**                               | Pedro: RG 552.071.833 SSP/SP (foto frente + verso)            |
| **CPF sócio**                              | Pedro: 438.360.178-22 (Inter consulta automatic)              |
| **Comprovante endereço PJ**                | Conta de luz/água/IPTU do endereço Rua Guilherme Faim, 20     |
| **Comprovante endereço residencial sócio** | Conta no nome Pedro (recente, ≤90 dias)                       |
| **Selfie sócio**                           | Inter app pede via reconhecimento facial in-app               |

---

## Passos

### Opção A: Pelo app (recomendado — mais rápido)

1. **Baixar Inter app**:
   - Android: Play Store → "Banco Inter"
   - iOS: App Store → "Inter Empresas" (pode ser app separado)

2. **Tela inicial**: tap **"Abrir conta"** → **"Conta Empresa (CNPJ)"**

3. **Step 1 — CNPJ**:
   - Digite `67084607000178`
   - Inter consulta Receita automaticamente
   - Confirma: **THEIADVISOR SAAS TECNOLOGIA LTDA** ATIVA
   - Tap **Continuar**

4. **Step 2 — Sócio Administrador**:
   - CPF: `438.360.178-22` → Inter consulta dados
   - Confirma nome: Pedro Leme Perin
   - Email: `team@theiadvisor.com` (ou pessoal Pedro)
   - Telefone: (Pedro decide)

5. **Step 3 — Endereço PJ**:
   - Rua Guilherme Faim, 20
   - Bairro / CEP (Pedro preenche)
   - Cidade: Ribeirão Preto / UF: SP
   - **Endereço comercial = residencial?** Sim, se for o caso (Pedro confirma).

6. **Step 4 — Atividade econômica**:
   - CNAE principal: **6203-1/00** (Desenvolvimento e licenciamento de programas
     de computador customizáveis)
   - Faturamento previsto mensal: até **R$ 10.000** (pre-launch)
   - Origem dos recursos: **Receita de vendas de software/serviços**

7. **Step 5 — Upload documentos**:
   - Contrato Social PDF
   - RG frente + verso
   - Selfie (Inter usa câmera frontal — siga instruções na tela)
   - Comprovante endereço PJ
   - Comprovante endereço sócio (se diferente)

8. **Step 6 — Senha + biometria**:
   - Crie senha 6 dígitos
   - Cadastre biometria (Face ID / digital)
   - Configure PIN backup

9. **Step 7 — Tipo de conta**:
   - Selecione **Conta corrente PJ** (padrão)
   - Opcional: marca **Conta poupança PJ** também (rende CDI, útil para reserva)

10. **Step 8 — Termos**:
    - Leia + aceita Termos de Uso + Política de Privacidade Inter
    - **Confirmar abertura**

11. **Aguarde**: Inter processa em 1-2 dias úteis. Você recebe email quando
    aprovado. Status visível em "Status da abertura" no app.

### Opção B: Pelo site (alternativa se Inter Empresas app falhar)

1. https://www.bancointer.com.br/conta-pj/
2. **NÃO clique em "Continuar no modo protegido"** do Kaspersky — Safe Money abre browser
   isolado fora do controle do flow. Clique em **"Continuar sem proteção"**.
3. Botão **"Abrir conta PJ"** → mesmo fluxo da opção A, mas via web.
4. Upload de docs via dropzones do site.

---

## Pós-aprovação (1-2 dias)

### Verificar dados da conta

Após aprovação, no app/web Inter Empresas:

1. **Conta corrente**: anote agência (sempre **0001**) + conta + dígito
2. **Chaves PIX**:
   - **Cadastrar chave PIX CNPJ**: `67084607000178` (será usada no Stripe payout)
   - (Opcional) Email `team@theiadvisor.com` como chave PIX adicional
3. **Cartões**: Inter PJ pode emitir cartão débito virtual (útil para Stripe billing
   próprio se precisar testar)

### Integralização do capital social

Contrato Social SLU define capital R$ 1.000,00 a integralizar.

1. **De**: conta corrente PJ Pedro pessoa física (qualquer banco)
2. **Para**: conta corrente PJ TheIAdvisor (Inter)
3. **Valor**: R$ 1.000,00
4. **Tipo**: TED ou PIX
5. **Descrição**: "Integralização capital social — Contrato Social cláusula 5"
6. **Importante**: guarde comprovante PDF — anexa ao Livro Diário/Razão (contador
   precisa para fechamento contábil)

### Configurar acesso compartilhado (se necessário)

Se Pedro for ter contador acessando direto:

1. App Inter Empresas → **Configurações** → **Usuários**
2. Add usuário do contador com perfil **Consulta apenas**
3. Contador recebe convite por email

---

## Troubleshooting

### "CNPJ não encontrado" durante onboarding

- Receita pode levar até 48h após emissão (01/06/2026) para responder bases externas
- Aguarde 24h e tente novamente
- Se urgente, **chat in-app Inter** pode fazer verificação manual

### "Documento ilegível" após upload

- Use PDF (não JPG) para Contrato Social
- RG: foto **com flash desligado**, em superfície plana, sem reflexos
- Selfie: ambiente bem iluminado, sem óculos, fundo neutro

### "Endereço não pôde ser verificado"

- Inter consulta Correios + RGE/Sabesp/IBGE
- Se endereço comercial = residencial: use comprovante no nome de quem mora lá
  (esposa/pais/inquilino — Pedro precisa do nome no comprovante)
- Alternativa: contrato de aluguel em nome da PJ (após CNPJ ativo)

### Conta bloqueada por compliance pós-abertura

- Comum em CNPJs novos (<3 meses)
- Inter pede comprovação de origem do capital (R$ 1.000)
- Anexa comprovante DECLARAÇÃO IRPF Pedro (se tem) + extrato bancário pessoa física
  mostrando saldo disponível

---

## Pós-T2 (carryover para T3)

Após Inter PJ ativa:

1. **T3 Stripe payout method**:
   - Dashboard Stripe → Settings → Bank accounts → **Add new bank account**
   - País: Brasil / Moeda: BRL
   - Tipo: **Checking account** (corrente)
   - Bank: **Banco Inter** (077)
   - Agência: **0001**
   - Conta: (digite a sua + dígito)
   - Titular: **THEIADVISOR SAAS TECNOLOGIA LTDA**
2. Stripe pode pedir verificação por micro-depósito (1-2 dias)
3. Após verificação: definir Inter PJ como **default payout method**
4. Desativar conta antiga (CPF) quando primeiro payout PJ confirmado

---

## Conexões importantes

- **CCM Ribeirão Preto** (NFS-e): aguardar contador. Sem CCM, Inter aceita receitas
  mas Pedro não pode emitir NFS-e legalmente. Receitas <R$ 5k/mês podem ser declaradas
  como autônomo no Simples Nacional sem NFS-e (mas ideal é resolver CCM logo).

- **Conta poupança PJ Inter**: útil para reserva de emergência (3-6 meses opex).
  Rendimento ~CDI 100% líquido (>= Tesouro Selic).

---

**Última atualização**: 02/06/2026 (S81 close)
**Bloqueado por**: nada (executável agora)
**Próximo passo após T2**: T3 Stripe payout update + integralização capital social
