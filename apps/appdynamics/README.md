# AppDynamics

Receives health rule violation notifications from AppDynamics via HTTP Request Template.

## Setup

In AppDynamics go to **Alert & Respond → HTTP Request Templates** and create a new template pointing to your StatuspageOne installation URL.

Create two actions — one for open events and one for close events.

**Open action payload:**
```json
{
  "type": "appdynamics.event.open",
  "app_name": "${latestEvent.application.name}",
  "policy_name": "${policy.name}",
  "event_id": "${latestEvent.id}",
  "event_type": "${latestEvent.eventType}",
  "severity": "${latestEvent.severity}",
  "affected_entity_type": "${latestEvent.affectedEntityType}",
  "affected_entity_name": "${latestEvent.displayName}",
  "event_summary": "${latestEvent.eventMessage}",
  "event_time": "${latestEvent.eventTime}",
  "deep_link_url": "${deeplink}"
}
```

**Close action payload:** same template with `"type": "appdynamics.event.resolved"`. Attach actions to your Health Rules.
