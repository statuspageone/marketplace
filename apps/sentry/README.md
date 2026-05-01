# Sentry

Receives issue alert notifications from Sentry via internal integration webhooks.

## Setup

In Sentry go to **Settings → Developer Settings → Internal Integrations** and create an integration with the webhook URL pointing to your StatuspageOne installation.

Enable webhook events for **Issues**. Sentry will POST to your URL when issues are created or resolved.

Sentry sends a fixed JSON payload — the body is not user-configurable. Event routing relies on the `action` field (`"created"` for new issues, `"resolved"` when resolved).

> **Platform note:** Sentry's payload cannot include a custom `type` field. The platform must be configured to inject `type` from `action` before the mapping engine runs — mapping `action: "created"` → `type: "sentry.issue.open"` and `action: "resolved"` → `type: "sentry.issue.resolved"`. Alternatively, rename the `sourceEvent` values in `mapping.yaml` to `created` and `resolved` to match the raw `action` values directly — confirm the routing mechanism with the platform team first.
