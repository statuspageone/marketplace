# Datadog

Receives monitor alert notifications from Datadog via webhook.

## Setup

In Datadog go to **Integrations → Webhooks** and create two webhook entries pointing to your StatuspageOne installation URL.

### Webhook 1 — Triggered alerts

Set the JSON body to:

```json
{
  "type": "datadog.alert.open",
  "monitor_id": "$ALERT_ID",
  "monitor_name": "$ALERT_TITLE",
  "description": "$EVENT_MSG",
  "alert_type": "$ALERT_TYPE",
  "priority": "$ALERT_PRIORITY",
  "tags": "$TAGS",
  "url": "$LINK",
  "date": "$DATE"
}
```

In your alert policy, use `@webhook-<name>` in the **Alert** message.

### Webhook 2 — Recovery alerts

Create a second webhook with the same URL and this body:

```json
{
  "type": "datadog.alert.resolved",
  "monitor_id": "$ALERT_ID",
  "monitor_name": "$ALERT_TITLE",
  "description": "$EVENT_MSG",
  "alert_type": "$ALERT_TYPE",
  "priority": "$ALERT_PRIORITY",
  "tags": "$TAGS",
  "url": "$LINK",
  "date": "$DATE"
}
```

In your alert policy, use `@webhook-<name>` in the **Recovery** message.
