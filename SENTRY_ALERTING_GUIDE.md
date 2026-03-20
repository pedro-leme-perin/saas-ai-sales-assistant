# Sentry Alerting Rules — Guia de Configuração

## Acessar: https://sentry.io → Settings → Alerts

---

## 1. Alert: Error Rate > 0.1%

- **Type:** Issue Alert
- **When:** Number of events > 10 in 5 minutes
- **Filter:** `level:error`
- **Action:** Email + Slack (se configurado)
- **Name:** `[SalesAI] High Error Rate`

## 2. Alert: 5xx Errors Spike

- **Type:** Metric Alert
- **Metric:** `count()` where `http.status_code:5*`
- **Threshold:** > 5 events in 1 minute (Critical), > 2 (Warning)
- **Action:** Email imediato
- **Name:** `[SalesAI] 5xx Error Spike`

## 3. Alert: API Latency p95 > 500ms

- **Type:** Metric Alert
- **Metric:** `p95(transaction.duration)`
- **Filter:** `transaction.op:http.server`
- **Threshold:** > 500ms (Warning), > 2000ms (Critical)
- **Window:** 5 minutes
- **Name:** `[SalesAI] High API Latency`

## 4. Alert: AI Latency p95 > 2s

- **Type:** Metric Alert
- **Metric:** `p95(transaction.duration)`
- **Filter:** `transaction:*/ai/*`
- **Threshold:** > 2000ms (Warning), > 5000ms (Critical)
- **Window:** 5 minutes
- **Name:** `[SalesAI] AI Provider Slow`

## 5. Alert: Unhandled Exceptions

- **Type:** Issue Alert
- **When:** First seen (new issue)
- **Filter:** `handled:no`
- **Action:** Email
- **Name:** `[SalesAI] New Unhandled Exception`

## 6. Alert: Web Vitals Regression

- **Type:** Metric Alert
- **Metric:** `p75(measurements.lcp)`
- **Threshold:** > 2500ms (Warning), > 4000ms (Critical)
- **Window:** 1 hour
- **Name:** `[SalesAI] LCP Regression`

---

## Configuração rápida (5 min):

1. Abrir https://sentry.io/organizations/YOUR-ORG/alerts/rules/
2. Click "Create Alert"
3. Selecionar projeto
4. Configurar cada regra acima
5. Testar com erro forçado: `throw new Error('Sentry test alert')`
