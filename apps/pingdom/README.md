# Pingdom

Receives check state notifications from Pingdom via webhook integration.

## Setup

In Pingdom go to **Integrations → Webhooks** and add a new webhook pointing to your StatuspageOne installation URL. Assign the webhook to your checks via **Alerting → Alert Policies**.

Pingdom sends `current_state: "DOWN"` for failures and `current_state: "UP"` for recoveries. The `type` routing field must be included in the payload — set `"type": "pingdom.check.down"` for DOWN alerts and `"type": "pingdom.check.up"` for UP alerts via the webhook payload template.

> **Note:** Consult [Pingdom webhook docs](https://documentation.solarwinds.com/en/success_center/pingdom/content/topics/integrations/webhooks.htm) for payload customisation options.
