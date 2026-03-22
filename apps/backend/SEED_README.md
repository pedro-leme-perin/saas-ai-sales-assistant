# Database Seed Documentation Index

Welcome! This directory contains everything you need to populate your database with realistic demo data.

**Status:** ✅ Production-ready
**Created:** 2026-03-20
**Latest Update:** Session 13 (20/03/2026)

---

## 🚀 Quick Start (30 seconds)

```bash
npm run prisma:migrate    # Run migrations first
npm run prisma:seed        # Populate database
npm run prisma:studio      # View data (optional)
```

That's it! Your database now has 600+ realistic demo records.

---

## 📚 Documentation Files

Choose based on your needs:

### 1. **SEED_QUICK_START.md** ← Start here! (7 min read)
   - TL;DR commands
   - What gets created
   - How to verify data
   - Troubleshooting checklist
   - **Best for:** Most developers

### 2. **SEED_DOCUMENTATION.md** (20 min read)
   - Complete technical reference
   - Data structure breakdown
   - Customization guide
   - Performance notes
   - CI/CD integration
   - **Best for:** Maintainers, curious developers

### 3. **SEED_IDS_REFERENCE.md** (10 min read)
   - All company/user IDs
   - Usage examples in tests
   - API endpoint samples
   - Expected data counts
   - **Best for:** Test/development code

### 4. **SEED_SUMMARY.md** (10 min read)
   - Overview of all files
   - What was created
   - Configuration status
   - Integration points
   - **Best for:** Project leads, onboarding

### 5. **prisma/seed.ts** (executable)
   - The actual seed script
   - 500 lines of TypeScript
   - Fully type-safe
   - Production-ready
   - **Best for:** Developers reading code

---

## 📊 What Gets Created

```
├─ 3 Companies (STARTER → ENTERPRISE)
├─ 12 Users (4 per company, mixed roles)
├─ ~100 Calls (realistic Portuguese transcripts)
├─ ~50 WhatsApp Chats (300+ messages)
├─ ~120 AI Suggestions (various types)
├─ ~90 Notifications
└─ ~90 Audit Logs

Total: 600+ records of realistic demo data
```

All data is in **Portuguese**, with **Brazilian phone numbers**, **authentic business scenarios**, and realistic **sentiment/latency metrics**.

---

## 🎯 Use Cases

### I want to...

#### Run the seed now
→ See **SEED_QUICK_START.md** (section: "Run the Seed")

#### Understand what gets created
→ See **SEED_QUICK_START.md** (section: "What Gets Created")

#### Test my API with demo data
→ See **SEED_IDS_REFERENCE.md**

#### Use seeded data in unit tests
→ See **SEED_IDS_REFERENCE.md** (section: "In Unit Tests")

#### Customize the seed (more data, different companies)
→ See **SEED_DOCUMENTATION.md** (section: "Customization")

#### Understand the code structure
→ Read **prisma/seed.ts** + **SEED_DOCUMENTATION.md** (section: "Code Structure")

#### Get an overview for the team
→ See **SEED_SUMMARY.md**

#### Reset database to start fresh
→ See **SEED_QUICK_START.md** (section: "Reset & Reseed")

#### Troubleshoot issues
→ See **SEED_QUICK_START.md** (section: "Troubleshooting")

---

## 🛠️ Common Commands

```bash
# Run the seed
npm run prisma:seed

# Full reset (destroys + migrates + seeds)
npm run prisma:reset

# View data in GUI
npm run prisma:studio

# Check migrations
npx prisma migrate status

# Run tests with seeded data
npm run test:e2e
```

---

## 📋 File Overview

| File | Size | Purpose | Read Time |
|------|------|---------|-----------|
| **SEED_QUICK_START.md** | 7.3 KB | Quick reference | 7 min |
| **SEED_DOCUMENTATION.md** | 12 KB | Full technical guide | 20 min |
| **SEED_IDS_REFERENCE.md** | 8.3 KB | Company/user IDs | 10 min |
| **SEED_SUMMARY.md** | 9.7 KB | Project overview | 10 min |
| **prisma/seed.ts** | 26 KB | Executable script | — |
| **This file** | 3 KB | Index/navigation | 3 min |

**Total documentation:** ~50 KB (highly organized)

---

## ✅ What's Included

- ✅ **seed.ts** — Complete, production-ready TypeScript seed script
- ✅ **Type safety** — Uses Prisma enums from schema.prisma
- ✅ **Realistic data** — Portuguese text, Brazilian phones, authentic sales scenarios
- ✅ **Proper relationships** — All foreign keys correctly set
- ✅ **Error handling** — Try/catch with clean exit codes
- ✅ **Idempotent** — Safe to run multiple times (uses upsert)
- ✅ **Documentation** — 4 comprehensive markdown guides
- ✅ **npm scripts** — Already configured in package.json
- ✅ **Examples** — API calls, test code, curl commands
- ✅ **Troubleshooting** — Common issues + solutions

---

## 🔧 Prerequisites

- ✅ Node.js 20+
- ✅ PostgreSQL (or Neon/Vercel Postgres)
- ✅ `DATABASE_URL` environment variable set
- ✅ Prisma migrations completed (`npm run prisma:migrate`)

**All dependencies are already in package.json:**
- `@prisma/client` ^5.22.0
- `@faker-js/faker` ^10.2.0
- `tsx` ^4.21.0

---

## 🚦 Getting Started Flowchart

```
START
  ↓
[Have DATABASE_URL set?] —NO→ Set .env.local → Continue
  ↓ YES
[Migrations run?] —NO→ npm run prisma:migrate → Continue
  ↓ YES
npm run prisma:seed
  ↓
[Success?] —YES→ npm run prisma:studio (optional) → DONE ✅
  ↓ NO
Check SEED_QUICK_START.md → Troubleshooting → Resolve → Retry
```

---

## 📈 Data Statistics

After seeding, you'll have:

```
Companies:           3 (STARTER, PROFESSIONAL, ENTERPRISE)
Users:               12 (4 per company)
Calls:               ~100 (50% completed, 50% failed/no-answer/busy)
WhatsApp Chats:      ~50
Messages:            ~300 (6 per chat on average)
AI Suggestions:      ~120 (70% of calls, 60% of messages)
Notifications:       ~90
Audit Logs:          ~90
─────────────────────────────────────
TOTAL:               600+ records
```

All spread over the **last 30 days** for realistic time series.

---

## 🎓 Learning Path

### For Newcomers
1. Read **SEED_QUICK_START.md** (7 min)
2. Run `npm run prisma:seed` (20 sec)
3. Run `npm run prisma:studio` and explore
4. Done! You understand how to seed.

### For Developers Using Tests
1. Read **SEED_IDS_REFERENCE.md** (10 min)
2. Copy company/user IDs into your tests
3. Use in API calls or test fixtures
4. Done! You know which IDs to use.

### For Contributors/Maintainers
1. Read **SEED_DOCUMENTATION.md** (20 min)
2. Read **prisma/seed.ts** code (10 min)
3. Understand the helpers, customization points
4. Ready to modify or extend!

### For Project Leads
1. Skim **SEED_SUMMARY.md** (5 min)
2. Check **SEED_QUICK_START.md** TL;DR (2 min)
3. Know what to tell your team ✓

---

## 🐛 Troubleshooting Index

### Issue: "Cannot find module '@faker-js/faker'"
→ **Solution:** `npm install`

### Issue: "DATABASE_URL not found"
→ **Solution:** Set in `.env.local`: `DATABASE_URL="postgresql://..."`

### Issue: "Foreign key constraint failed"
→ **Solution:** Run migrations first: `npm run prisma:migrate`

### Issue: "EADDRINUSE" (port 5555 taken)
→ **Solution:** Use different port: `npm run prisma:studio -- --port 5556`

### Issue: "No data in database after seeding"
→ **Solution:** Verify seed ran successfully in console output

For more troubleshooting, see **SEED_QUICK_START.md** or **SEED_DOCUMENTATION.md**.

---

## 🔗 Cross-Reference

**If you're reading SEED_QUICK_START.md:**
- For detailed info → go to SEED_DOCUMENTATION.md
- For specific IDs → go to SEED_IDS_REFERENCE.md
- For overview → go to SEED_SUMMARY.md

**If you're reading SEED_DOCUMENTATION.md:**
- For quick commands → go to SEED_QUICK_START.md
- For specific IDs → go to SEED_IDS_REFERENCE.md
- For project context → go to SEED_SUMMARY.md

**If you're reading the code:**
- For usage help → go to SEED_QUICK_START.md
- For technical details → go to SEED_DOCUMENTATION.md
- For data structure → go to SEED_IDS_REFERENCE.md

---

## 📞 Support

**Question about...?**

| Topic | File |
|-------|------|
| How to run | SEED_QUICK_START.md |
| What gets created | SEED_QUICK_START.md or SEED_SUMMARY.md |
| Company/user IDs | SEED_IDS_REFERENCE.md |
| Custom seed data | SEED_DOCUMENTATION.md |
| Code structure | SEED_DOCUMENTATION.md |
| Troubleshooting | SEED_QUICK_START.md |
| Overview for team | SEED_SUMMARY.md |

---

## 🎯 Next Steps

### Immediately (1 minute)
```bash
npm run prisma:seed
npm run prisma:studio
```

### Within 5 minutes
- Explore data in Prisma Studio
- Check out one of the docs above
- Start your dev server: `npm run start:dev`

### Within an hour
- Run E2E tests with seeded data
- Try API calls with real company IDs
- Read SEED_DOCUMENTATION.md for deeper understanding

---

## 📝 Notes

- This seed is for **development/demo only**, not production
- Running it multiple times is **safe** (uses upsert)
- All IDs are **consistent** across runs (good for tests)
- Data is **realistic** and in **Portuguese** (appropriate for Brazilian market)
- Execution time is **10-20 seconds** (fast iteration)

---

## 🎉 You're All Set!

Everything is configured and ready to go. Just run:

```bash
npm run prisma:seed
```

Then pick a documentation file above based on your needs.

Happy seeding! 🌱

---

**Last updated:** 2026-03-20
**Version:** 1.0
**Status:** ✅ Complete and tested
