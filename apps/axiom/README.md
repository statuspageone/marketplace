# Axiom

Source app for ingesting Axiom monitor notifications through the Axiom custom webhook notifier.

## Setup

1. In Axiom, open `Monitors` and create or edit a notifier.
2. Choose `Custom webhook`.
3. Configure the webhook URL that points to the marketplace webhook endpoint for this installation.
4. Use a JSON template that includes a top-level `type` field so StatuspageOne can map the event.

Example payload template:

```json
{
  "type": "{{ if eq .Action \"Open\" }}monitor.open{{ else }}monitor.resolved{{ end }}",
  "action": "{{.Action}}",
  "event": {
    "monitorID": "{{.MonitorID}}",
    "body": "{{.Body}}",
    "description": "{{.Description}}",
    "timestamp": "{{.Timestamp}}",
    "title": "{{.Title}}",
    "sourceURL": "https://app.axiom.co/your-org-id/monitors/{{.MonitorID}}",
    "matchedEvent": {{jsonObject .MatchedEvent}}
  }
}
```

Keep all examples sanitized. Do not include real URLs, tokens, or customer data.
