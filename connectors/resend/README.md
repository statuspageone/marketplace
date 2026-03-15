# Resend Sample Connector

This sample shows how to represent a provider that can push email lifecycle events by webhook while also supporting list-style polling for backfill and reconciliation.

## Why both modes are present

- `webhook.yaml` covers near-real-time email events and signature metadata.
- `polling.yaml` covers cursor-based backfill when webhooks were unavailable or need reconciliation.

## Public-safety notes

- OAuth values are placeholders expressed as environment variable names only.
- Fixture payloads use example domains, redacted IDs, and synthetic recipients.
- The mapping focuses on canonical request-log fields without including runtime code.
