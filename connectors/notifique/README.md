# Notifique Connector

Notifique is a multi-channel messaging provider (WhatsApp, SMS, email, push). This connector describes how StatuspageOne can ingest request-log and delivery events from Notifique via webhooks and polling.

## Why both modes are present

- **webhook.json**: Notifique pushes events to a URL you register with `POST /v1/webhooks`. Events are signed with HMAC-SHA256 (`X-Notifique-Signature`: `t={timestamp},v1={hash}`). Use the webhook secret returned at subscription time to verify payloads.
- **polling.json**: `GET /v1/webhooks/deliveries` returns paginated delivery logs (offset-based: `page`, `limit`). Use for backfill or when webhooks were unavailable.

## Auth

Notifique uses API Key authentication. The connector declares the `Authorization` header (value: `Bearer <key>`); the provider also accepts `x-api-key: <key>`. Required scope for webhooks and deliveries: `webhooks:read` or `webhooks:manage`. Use the env var name declared in `auth.json`; never commit real keys.

## Route normalization

- Outbound message/sms/email/push lifecycle events map to canonical `request_log.created` and `request_log.updated`.
- Field mapping uses the top-level payload (`event`, `messageId`, `timestamp`, `workspaceId`) and `data` (e.g. `data.to`, `data.status`) as in the provider’s webhook documentation.

## Public-safety notes

- API key and webhook secret are referenced by environment variable names only.
- Fixtures use redacted IDs, example phone numbers, and placeholder workspace/instance/message identifiers. No real customer data or secrets.
