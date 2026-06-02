# T1 — Stripe CPF → CNPJ migração (runbook manual)

**Status**: Cowork não pode automatizar (Stripe Dashboard bloqueado por safety financeira da Chrome MCP).
**Tempo estimado**: 10-15 min execução + 2-3 dias úteis revalidação Stripe.
**Pré-requisitos**: Acesso a `dashboard.stripe.com` com a conta da TheIAdvisor.

---

## Contexto

A conta Stripe atual está sob CPF do Pedro (438.360.178-22). Após constituição da SLU
(01/06/2026), a receita precisa fluir sob CNPJ 67.084.607/0001-78 para compliance fiscal
(emissão de NFS-e, Simples Nacional Anexo III via Fator R).

**Atenção**: Esta migração inicia revalidação KYC do Stripe (2-3 dias úteis). Durante
esse período:

- Checkouts continuam funcionando normalmente
- Payouts podem ser pausados até revalidação concluir
- Nenhum impacto em webhooks ou subscriptions já ativas

---

## Dados a inserir

| Campo Stripe         | Valor                                                      |
| -------------------- | ---------------------------------------------------------- |
| Tipo de conta        | Empresa (Business) — Pessoa Jurídica                       |
| Tipo de entidade     | Sociedade Limitada (LLC) — selecione **SLU se disponível** |
| Razão Social         | THEIADVISOR SAAS TECNOLOGIA LTDA                           |
| Nome Fantasia        | TheIAdvisor                                                |
| CNPJ                 | 67.084.607/0001-78 (sem máscara: 67084607000178)           |
| Data de constituição | 01/06/2026                                                 |
| Setor / CNAE         | Tecnologia / Software / SaaS (CNAE 6203-1/00)              |
| Endereço comercial   | Rua Guilherme Faim, 20 — Ribeirão Preto/SP                 |
| CEP                  | (verificar com contador)                                   |
| País                 | Brasil                                                     |
| Website              | https://theiadvisor.com                                    |
| Telefone comercial   | (Pedro decide qual usar)                                   |
| Email comercial      | team@theiadvisor.com                                       |
| Sócio único (Pedro)  | CPF 438.360.178-22, RG 552.071.833 SSP/SP                  |

---

## Passos

### 1. Login no Stripe

1. Abra https://dashboard.stripe.com em browser **fora do Kaspersky Safe Money**
   (clica em "Continuar sem proteção" se Safe Money interceptar) ou desative
   temporariamente a proteção em `Configurações Kaspersky → Safe Money → Excluir`
   para dashboard.stripe.com
2. Login com a conta TheIAdvisor (live mode)

### 2. Settings → Business → Account details

1. Canto superior direito: clique no nome da conta → **Settings**
2. Na sidebar esquerda: seção **Business** → **Account details**
   (URL direta: `https://dashboard.stripe.com/settings/business_details`)

### 3. Update business type

1. Botão **Update** ou **Edit** ao lado de "Business type"
2. Selecione **Company** / **Business** (deixe de ser "Individual")
3. Tipo de entidade: **Limited liability company (LLC)** se disponível, senão
   **Other (private corporation)**
4. **Continue**

### 4. Preencher dados da empresa

Use a tabela "Dados a inserir" acima. Atenção a:

- **Legal business name**: digite EXATAMENTE como na Razão Social (sem abreviar)
- **Tax ID type**: selecione **CNPJ**
- **Tax ID**: cole `67.084.607/0001-78` ou `67084607000178`
  (Stripe aceita ambos; valida via Receita Federal)
- **Business address**: endereço da sede (Guilherme Faim 20) — mesmo que residencial
- **Business website**: `https://theiadvisor.com` (Stripe verifica HTTPS + SSL válido)

### 5. Dados do representante (Pedro)

1. **Representative** ou **Owner** seção
2. Nome completo: Pedro Leme Perin
3. CPF: 438.360.178-22
4. Data de nascimento: (Pedro preenche)
5. Endereço residencial: (Pedro preenche — pode ser igual ao comercial)
6. Cargo: **CEO** ou **Sole Director** (Sócio Administrador)
7. % de ownership: **100%** (SLU)

### 6. **NÃO** atualizar bank account ainda

Stripe pode pedir nova conta bancária (CNPJ). Como **T2 (Inter PJ) ainda não foi aberta**,
deixe a conta bancária atual (CPF) por enquanto. Stripe permite payouts continuarem na
conta antiga até você atualizar.

**Se Stripe forçar atualização imediata**: marque para fazer depois ("Skip for now" ou
similar) e prossiga. Se não permitir skip, pause T1 aqui e abra T2 primeiro.

### 7. Submit

1. Revise todos os campos
2. **Submit** ou **Save changes**
3. Stripe mostra mensagem "Verification in progress" — 2-3 dias úteis

### 8. Validação pós-migração

Aguarde email do Stripe ("Verification complete" ou similar). Verifique:

1. Dashboard → Settings → Business → Account details: deve mostrar **CNPJ 67.084.607/0001-78**
2. Dashboard → Settings → Account: tipo deve ser **Company** (não Individual)
3. Próximas faturas devem vir com CNPJ no header

### 9. Tabular fluxo de fatura PJ (opcional)

Após T1 + T2 + T3 concluídos, atualize templates de fatura Stripe:

- Settings → Branding: logo TheIAdvisor
- Settings → Customer emails: footer com CNPJ + razão social
- (Se aplicável) Tax rates: configurar alíquotas Simples Nacional

---

## Troubleshooting

### "Tax ID invalid"

- Verifique se está usando CNPJ correto: **67.084.607/0001-78**
- Tente sem máscara: **67084607000178**
- Se persistir, aguarde 24h — Receita Federal pode levar até 48h após emissão para
  responder consultas externas como Stripe

### "Business name doesn't match Tax ID"

- Use razão social EXATA: **THEIADVISOR SAAS TECNOLOGIA LTDA**
- Não use nome fantasia "TheIAdvisor" neste campo
- Não inclua sufixos como "ME" ou "LTDA — ME"

### "Address verification failed"

- Use o endereço EXATO do contrato social: Rua Guilherme Faim, 20 — Ribeirão Preto/SP
- CEP deve bater com Correios (consultar buscacep.correios.com.br)
- Se necessário, anexe comprovante de endereço PJ (Stripe pode pedir)

### Conta bloqueada pós-update

- Stripe Risk pode revisar manualmente migrações grandes
- Email: support@stripe.com / chat in-dashboard
- Tempo médio resolução: 24-48h

---

## Pós-T1 (carryover S82)

Após T1 concluído + T2 (Inter PJ) aberta:

- **T3**: Settings → Bank accounts → Add new bank account → Inter PJ
- Definir Inter PJ como **default payout method**
- Aguardar 1-2 dias para Stripe validar nova conta via micro-depósito
- Desativar conta antiga (CPF) após primeiro payout PJ confirmado

---

## Anexos

- CNPJ ATIVO comprovante: Receita Federal → Consulta Cartão CNPJ
  (https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp)
- Contrato Social SLU: arquivo PDF do REDESIM (protocolo SPP2630711235)
- Comprovante endereço: (Pedro fornece — conta de luz / aluguel)

---

**Última atualização**: 02/06/2026 (S81 close)
**Bloqueado por**: nada (executável agora)
**Próximo passo após T1**: Abrir conta Inter PJ (T2) → atualizar Stripe payout method (T3)
