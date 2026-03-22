# 🌱 Quick Start — Database Seeding

## TL;DR

```bash
# 1. Make sure migrations are done
npm run prisma:migrate

# 2. Run the seed
npm run prisma:seed

# 3. View the data in Prisma Studio
npm run prisma:studio
```

Done! Your database now has 3 demo companies with ~600 records of realistic data.

---

## What Gets Created?

```
📦 3 Companies
   ├─ ACME Sales Solutions (ENTERPRISE)
   ├─ TechStart Ventures (PROFESSIONAL)
   └─ Prime Imóveis (STARTER)

👥 12 Users (4 per company)
   └─ Roles: OWNER, ADMIN, MANAGER, VENDOR

📞 ~100 Calls
   ├─ Status: COMPLETED, FAILED, NO_ANSWER, BUSY
   ├─ Portuguese transcripts (sales scenarios)
   ├─ Sentiment: 0.25-0.95
   └─ ~70% have AI suggestions

💬 ~50 WhatsApp Chats
   ├─ ~300 messages total
   ├─ Realistic Portuguese conversations
   └─ ~60% of outgoing messages have AI suggestions

🤖 ~120 AI Suggestions
   ├─ Types: GREETING, OBJECTION_HANDLING, CLOSING, QUESTION, etc.
   ├─ Models: gpt-4o-mini, claude-3-sonnet, gemini-pro
   └─ Confidence: 0.75-0.99

🔔 ~90 Notifications
   ├─ Types: CALL_STARTED, NEW_MESSAGE, AI_SUGGESTION, etc.
   └─ Channels: IN_APP, EMAIL

📝 ~90 Audit Logs
   └─ Actions: CREATE, READ, UPDATE, LOGIN, EXPORT
```

**Total:** 600+ demo records spanning realistic business scenarios.

---

## Database Setup

### Prerequisites

- ✅ PostgreSQL running (local or cloud)
- ✅ `DATABASE_URL` set in `.env.local`
- ✅ Node.js 20+

### .env.local

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/saas_ai_dev"
# OR
DATABASE_URL="postgresql://user:password@neon.tech/database_name"
```

### Run Migrations First

```bash
npm run prisma:migrate
```

This creates all the database tables.

---

## Run the Seed

```bash
# Standard way
npm run prisma:seed

# Or with npm script
npm run prisma:seed

# Or directly with tsx
tsx prisma/seed.ts
```

Output should look like:

```
🌱 Iniciando seed de dados de demonstração...

📦 Criando empresas de demonstração...
✅ 3 empresas criadas
   - ACME Sales Solutions (ENTERPRISE)
   - TechStart Ventures (PROFESSIONAL)
   - Prime Imóveis (STARTER)

👥 Criando usuários de demonstração...
   - Empresa "ACME Sales Solutions": 4 usuários criados
   ...

📞 Criando ligações de demonstração...
   - Empresa "ACME Sales Solutions": 28 ligações criadas
   ...

[... more output ...]

📊 RESUMO DO SEED DE DADOS
====================================================================

🏢 EMPRESAS:
   ACME Sales Solutions (ENTERPRISE)
      ID: demo-company-acme
      👥 Usuários: 4
      📞 Ligações: 28
      💬 Chats WhatsApp: 8
      💭 Mensagens: 48
      ...

📈 TOTAIS GERAIS:
   👥 Usuários: 12
   📞 Ligações: 102
   💬 Chats WhatsApp: 54
   💭 Mensagens: 324
   🤖 Sugestões de IA: 122
   🔔 Notificações: 90
   📝 Audit Logs: 90

🎉 SEED COMPLETADO COM SUCESSO!
```

---

## Verify Data

### Option 1: Prisma Studio (GUI)

```bash
npm run prisma:studio
```

Opens `http://localhost:5555` — browse all tables visually.

### Option 2: Direct Query

```bash
# Via Prisma CLI
npx prisma db query

# Or use psql if PostgreSQL
psql $DATABASE_URL -c "SELECT COUNT(*) FROM calls;"
```

### Option 3: In Your App

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const stats = {
  companies: await prisma.company.count(),
  calls: await prisma.call.count(),
  whatsappChats: await prisma.whatsappChat.count(),
};

console.log(stats);
```

---

## Reset & Reseed

To clear everything and start fresh:

```bash
# Destroys data, re-runs migrations, re-seeds
npm run prisma:reset
```

⚠️ **This is destructive!** All data is deleted.

---

## Seed Anatomy

### File: `prisma/seed.ts`

- **Length:** ~500 lines
- **Main function:** `main()`
- **Error handling:** Try/catch with clean exit
- **Helper functions:** `generateBrazilianPhone()`, `generateSentimentScore()`, etc.

### What It Does

1. Create 3 demo companies (ACME, TechStart, Prime Imóveis)
2. Create 4 users per company (OWNER, ADMIN, MANAGER, VENDOR)
3. Create ~100 calls with realistic Portuguese transcripts
4. Create ~50 WhatsApp chats with conversational messages
5. Create AI suggestions for 70% of calls + 60% of messages
6. Create 90 notifications across all users
7. Create 90 audit logs tracking various actions
8. Output summary with counts

---

## Customization

### Change Amount of Data

```typescript
// In seed.ts, around line 240
const callsPerCompany = Math.floor(20 + Math.random() * 10); // currently 20-30

// Change to create fewer calls:
const callsPerCompany = Math.floor(5 + Math.random() * 5); // 5-10
```

### Add More Companies

Edit the `Promise.all()` block around line 50 and add another `prisma.company.upsert()`.

### Change Portuguese Text

Look for:

- `callTranscripts` array (line ~73) — call transcripts
- `whatsappConversations` array (line ~100) — chat messages
- `aiSuggestions` array (line ~140) — AI suggestion templates

---

## Troubleshooting

### ❌ "Cannot connect to database"

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Verify connectivity
psql $DATABASE_URL -c "SELECT 1;"

# If using Neon, check network rules
```

### ❌ "Foreign key constraint failed"

Migrations didn't run. Execute:

```bash
npm run prisma:migrate
```

### ❌ "Module not found: @faker-js/faker"

```bash
npm install
pnpm install
```

### ❌ "EADDRINUSE" or "Port already in use" (Studio)

Another process is using port 5555:

```bash
# Kill it or use different port
npm run prisma:studio -- --port 5556
```

---

## Next Steps

After seeding:

### 1. View Data
```bash
npm run prisma:studio
```

### 2. Start Development
```bash
npm run start:dev
```

### 3. Test API Endpoints

```bash
# Get a company
curl http://localhost:3001/api/companies/demo-company-acme \
  -H "Authorization: Bearer YOUR_TOKEN"

# List calls
curl http://localhost:3001/api/calls?companyId=demo-company-acme \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Run E2E Tests

```bash
npm run test:e2e
```

Uses seeded data for integration testing.

---

## Files

| File | Purpose |
|------|---------|
| `prisma/seed.ts` | Main seed script (500 lines) |
| `prisma/SEED_DOCUMENTATION.md` | Full documentation |
| `SEED_QUICK_START.md` | This file |

---

## Performance

- **Execution time:** 10-20 seconds
- **Database size:** ~2-5 MB (depending on text fields)
- **Scalability:** Tested with 3x data volume

---

## Important Notes

### Idempotency

The seed uses `upsert()` on main entities (Company, User), so you can run it multiple times safely. **However:**

- Calls, chats, and messages are always created fresh
- Use `npm run prisma:reset` to clear before re-seeding

### Data Realism

All data is designed to be realistic:

- ✅ Brazilian phone numbers (+55 11 9xxxx-xxxx)
- ✅ Portuguese business conversations
- ✅ Realistic timestamps (last 30 days)
- ✅ Realistic sentiment scores (0.25-0.95)
- ✅ Realistic AI latencies (150-1650ms)

### Production

⚠️ **Never run this in production!**

This seed is for development/demo only. In production, use proper data migration pipelines.

---

## Support

For detailed information, see `prisma/SEED_DOCUMENTATION.md`.

For issues, check your:
1. `DATABASE_URL` environment variable
2. Database connectivity
3. Prisma migrations status (`npx prisma migrate status`)

---

*Last updated: 2026-03-20*
