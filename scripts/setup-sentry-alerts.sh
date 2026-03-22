#!/usr/bin/env bash
# ============================================================
# Setup Sentry Alerting Rules via API
# Ref: https://docs.sentry.io/api/alerts/
# ============================================================

set -euo pipefail

# ── Config ───────────────────────────────────────────────────
SENTRY_ORG="${SENTRY_ORG:?Set SENTRY_ORG env var}"
SENTRY_PROJECT="${SENTRY_PROJECT:?Set SENTRY_PROJECT env var}"
SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:?Set SENTRY_AUTH_TOKEN env var}"
SENTRY_API="https://sentry.io/api/0"

header="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"
content_type="Content-Type: application/json"

echo "🔧 Configuring Sentry alerts for ${SENTRY_ORG}/${SENTRY_PROJECT}..."

# ── Helper ───────────────────────────────────────────────────
create_issue_alert() {
  local name="$1"
  local payload="$2"
  echo "  → Creating issue alert: ${name}"
  curl -s -X POST \
    "${SENTRY_API}/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/rules/" \
    -H "${header}" \
    -H "${content_type}" \
    -d "${payload}" | jq -r '.name // .detail // "error"'
}

create_metric_alert() {
  local name="$1"
  local payload="$2"
  echo "  → Creating metric alert: ${name}"
  curl -s -X POST \
    "${SENTRY_API}/organizations/${SENTRY_ORG}/alert-rules/" \
    -H "${header}" \
    -H "${content_type}" \
    -d "${payload}" | jq -r '.name // .detail // "error"'
}

# ── 1. High Error Rate ──────────────────────────────────────
create_issue_alert "[SalesAI] High Error Rate" '{
  "name": "[SalesAI] High Error Rate",
  "actionMatch": "all",
  "filterMatch": "all",
  "frequency": 300,
  "conditions": [
    {
      "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
      "value": 10,
      "comparisonType": "count",
      "interval": "5m"
    }
  ],
  "filters": [
    {
      "id": "sentry.rules.filters.level.LevelFilter",
      "match": "gte",
      "level": "40"
    }
  ],
  "actions": [
    {
      "id": "sentry.mail.actions.NotifyEmailAction",
      "targetType": "IssueOwners",
      "fallthroughType": "ActiveMembers"
    }
  ]
}'

# ── 2. 5xx Error Spike ──────────────────────────────────────
create_metric_alert "[SalesAI] 5xx Error Spike" "{
  \"name\": \"[SalesAI] 5xx Error Spike\",
  \"dataset\": \"events\",
  \"aggregate\": \"count()\",
  \"query\": \"http.status_code:5*\",
  \"timeWindow\": 1,
  \"thresholdType\": 0,
  \"resolveThreshold\": 0,
  \"triggers\": [
    {
      \"label\": \"critical\",
      \"alertThreshold\": 5,
      \"actions\": [
        {
          \"type\": \"email\",
          \"targetType\": \"team\",
          \"targetIdentifier\": \"\"
        }
      ]
    },
    {
      \"label\": \"warning\",
      \"alertThreshold\": 2,
      \"actions\": []
    }
  ],
  \"projects\": [\"${SENTRY_PROJECT}\"]
}"

# ── 3. API Latency p95 > 500ms ──────────────────────────────
create_metric_alert "[SalesAI] High API Latency" "{
  \"name\": \"[SalesAI] High API Latency\",
  \"dataset\": \"transactions\",
  \"aggregate\": \"p95(transaction.duration)\",
  \"query\": \"transaction.op:http.server\",
  \"timeWindow\": 5,
  \"thresholdType\": 0,
  \"resolveThreshold\": 400,
  \"triggers\": [
    {
      \"label\": \"critical\",
      \"alertThreshold\": 2000,
      \"actions\": [
        {
          \"type\": \"email\",
          \"targetType\": \"team\",
          \"targetIdentifier\": \"\"
        }
      ]
    },
    {
      \"label\": \"warning\",
      \"alertThreshold\": 500,
      \"actions\": []
    }
  ],
  \"projects\": [\"${SENTRY_PROJECT}\"]
}"

# ── 4. AI Provider Latency p95 > 2s ─────────────────────────
create_metric_alert "[SalesAI] AI Provider Slow" "{
  \"name\": \"[SalesAI] AI Provider Slow\",
  \"dataset\": \"transactions\",
  \"aggregate\": \"p95(transaction.duration)\",
  \"query\": \"transaction:*/ai/*\",
  \"timeWindow\": 5,
  \"thresholdType\": 0,
  \"resolveThreshold\": 1500,
  \"triggers\": [
    {
      \"label\": \"critical\",
      \"alertThreshold\": 5000,
      \"actions\": [
        {
          \"type\": \"email\",
          \"targetType\": \"team\",
          \"targetIdentifier\": \"\"
        }
      ]
    },
    {
      \"label\": \"warning\",
      \"alertThreshold\": 2000,
      \"actions\": []
    }
  ],
  \"projects\": [\"${SENTRY_PROJECT}\"]
}"

# ── 5. New Unhandled Exception ───────────────────────────────
create_issue_alert "[SalesAI] New Unhandled Exception" '{
  "name": "[SalesAI] New Unhandled Exception",
  "actionMatch": "all",
  "filterMatch": "all",
  "frequency": 60,
  "conditions": [
    {
      "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
    }
  ],
  "filters": [
    {
      "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
      "key": "handled",
      "match": "eq",
      "value": "no"
    }
  ],
  "actions": [
    {
      "id": "sentry.mail.actions.NotifyEmailAction",
      "targetType": "IssueOwners",
      "fallthroughType": "ActiveMembers"
    }
  ]
}'

# ── 6. LCP Regression ───────────────────────────────────────
create_metric_alert "[SalesAI] LCP Regression" "{
  \"name\": \"[SalesAI] LCP Regression\",
  \"dataset\": \"transactions\",
  \"aggregate\": \"p75(measurements.lcp)\",
  \"query\": \"\",
  \"timeWindow\": 60,
  \"thresholdType\": 0,
  \"resolveThreshold\": 2000,
  \"triggers\": [
    {
      \"label\": \"critical\",
      \"alertThreshold\": 4000,
      \"actions\": [
        {
          \"type\": \"email\",
          \"targetType\": \"team\",
          \"targetIdentifier\": \"\"
        }
      ]
    },
    {
      \"label\": \"warning\",
      \"alertThreshold\": 2500,
      \"actions\": []
    }
  ],
  \"projects\": [\"${SENTRY_PROJECT}\"]
}"

echo ""
echo "✅ All 6 Sentry alert rules created!"
echo "   Verify at: https://sentry.io/organizations/${SENTRY_ORG}/alerts/rules/"
