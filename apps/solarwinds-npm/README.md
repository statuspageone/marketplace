# SolarWinds NPM

Receives alert notifications from SolarWinds Network Performance Monitor via HTTP webhook action.

## Setup

In SolarWinds NPM go to **Alerts & Activity → Alerts**, open an alert definition, and add an HTTP webhook action under **Trigger Actions** and **Reset Actions**.

**Trigger action body:**
```json
{
  "type": "solarwinds-npm.alert.open",
  "AlertName": "${AlertName}",
  "AlertSeverity": "${AlertSeverity}",
  "AlertMessage": "${AlertMessage}",
  "AlertTriggerTime": "${AlertTriggerTime}",
  "AlertResetTime": "${AlertResetTime}",
  "NetworkObjectName": "${NetworkObjectName}",
  "NetworkObjectType": "${NetworkObjectType}",
  "AlertUrl": "${AlertDetailsUrl}"
}
```

**Reset action body:** same template with `"type": "solarwinds-npm.alert.resolved"`.
