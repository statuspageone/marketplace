# New Relic

Receives incident notifications from New Relic Alerts via Workflow webhook destination.

## Setup

In New Relic go to **Alerts → Workflows** and create a workflow with a Webhook destination pointing to your StatuspageOne installation URL.

Under **Payload template**, use:

```json
{
  "type": "{{#if issueActivatedAt}}newrelic.incident.open{{else}}newrelic.incident.resolved{{/if}}",
  "id": "{{issueId}}",
  "issueUrl": "{{issuePageUrl}}",
  "title": "{{accumulations.conditionName.[0]}}",
  "priority": "{{priority}}",
  "state": "{{state}}",
  "trigger": "{{triggerEvent}}",
  "createdAt": "{{createdAt}}",
  "updatedAt": "{{updatedAt}}",
  "closedAt": "{{closedAt}}",
  "totalIncidents": {{totalIncidents}},
  "alertPolicyNames": {{json accumulations.policyName}},
  "alertConditionNames": {{json accumulations.conditionName}},
  "workflowName": "{{workflowName}}"
}
```
