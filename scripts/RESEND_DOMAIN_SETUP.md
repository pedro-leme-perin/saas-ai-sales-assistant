# Resend — Domain Verification Setup

## 1. Acessar Resend Dashboard

https://resend.com/domains → "Add Domain"

## 2. Adicionar domínio

Inserir o domínio de envio (ex: `mail.seudominio.com.br` ou `seudominio.com.br`).

## 3. Configurar DNS Records

Resend fornecerá 3 registros DNS a configurar no seu provedor:

| Tipo | Host | Valor | TTL |
|------|------|-------|-----|
| MX | `mail.seudominio.com.br` | `feedback-smtp.us-east-1.amazonses.com` | 3600 |
| TXT | `mail.seudominio.com.br` | `v=spf1 include:amazonses.com ~all` | 3600 |
| CNAME | `resend._domainkey.seudominio.com.br` | (valor fornecido pelo Resend) | 3600 |

**Nota:** valores exatos variam — copiar do painel Resend.

## 4. Verificar

Após propagação DNS (até 48h, geralmente <1h):
- Resend verifica automaticamente
- Status muda para "Verified"

## 5. Atualizar variáveis de ambiente

```bash
# Backend (.env / Railway)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@seudominio.com.br
```

## 6. Testar

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "SalesAI <noreply@seudominio.com.br>",
    "to": "teste@email.com",
    "subject": "Test",
    "text": "Domain verification OK"
  }'
```

## 7. Checklist

- [ ] Domínio adicionado no Resend
- [ ] 3 DNS records configurados
- [ ] Status "Verified" no painel
- [ ] `EMAIL_FROM` atualizado no Railway
- [ ] Email de teste enviado com sucesso
