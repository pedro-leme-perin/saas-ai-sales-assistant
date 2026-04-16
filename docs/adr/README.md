# Architecture Decision Records (ADRs)

This directory formalizes the architectural decisions documented inline in `CLAUDE.md § 13`.
Each ADR follows the format from *Fundamentals of Software Architecture* Cap. 19:
Title → Status → Context → Decision → Consequences → Compliance → Notes.

## Index

| #   | Title                                             | Status  | Inline ref |
| --- | ------------------------------------------------- | ------- | ---------- |
| 001 | Monolith Modular + Event-Driven Architecture      | Aceito  | CLAUDE.md  |
| 002 | PostgreSQL como banco principal                    | Aceito  | CLAUDE.md  |
| 003 | Multi-tenancy por shared DB + companyId           | Aceito  | CLAUDE.md  |
| 004 | Redis adapter para WebSocket horizontal scaling   | Aceito  | CLAUDE.md  |
| 005 | Clerk para auth (não construir próprio)           | Aceito  | CLAUDE.md  |
| 006 | Deepgram para STT                                 | Aceito  | CLAUDE.md  |
| 007 | Circuit breaker em integrações externas           | Aceito  | CLAUDE.md  |
| 008 | [SQL-level aggregation over app-level](./008-sql-level-aggregation.md) | Aceito  | this dir |
| 009 | [Multi-tenancy via shared DB + companyId](./009-multi-tenancy-shared-db.md) | Aceito  | this dir (formaliza #003) |
| 010 | [Observability stack — Sentry + OTel + Axiom](./010-observability-stack.md) | Aceito  | this dir |

## When to create an ADR

Create an ADR whenever the team makes a decision that:

- Affects module boundaries or dependencies
- Changes a foundational technology (DB, auth provider, queue)
- Establishes a pattern that future code must follow
- Accepts a significant trade-off (performance vs. correctness, speed vs. security)

Small, reversible decisions do NOT need an ADR.

## Template

See [template.md](./template.md). Copy it and rename to `NNN-short-kebab-title.md`.
