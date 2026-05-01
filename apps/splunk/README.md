# Splunk

Receives alert notifications from Splunk via the webhook alert action.

## Setup

In Splunk open a saved search and go to **Edit → Edit Alert**. Under **Actions**, add a **Webhook** action pointing to your StatuspageOne installation URL.

To set the `type` routing field, use a custom alert action or scripted alert. Create separate saved searches for firing vs resolved states and hardcode the `type` in each payload.

Refer to [Splunk webhook docs](https://docs.splunk.com/Documentation/Splunk/latest/Alert/Webhooks) for payload details.
