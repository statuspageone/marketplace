# Destination Template

Use this template to author a new destination app.

## Getting Started

1. Copy this template to `apps/destinations/<your-slug>/`.
2. Edit `manifest.yaml`: update `slug`, `name`, `description`, `documentationUrl`.
3. Edit `auth.yaml`: choose strategy (`webhook_url`, `bearer`, or `none`).
4. Edit `destinations.yaml`: define config fields shown to users.
5. Edit `destination-webhook.yaml`: define the HTTP request template.
6. Add sanitized fixture to `fixtures/`.
7. Run `pnpm validate` before opening a PR.

## Auth Strategies

- `webhook_url` — user pastes a webhook URL; available as `{{installation.webhook_url}}`
- `bearer` — user provides an API token sent as a Bearer header
- `none` — no auth required (e.g., public endpoints)

## Liquid Template Variables

- `{{installation.webhook_url}}` — the webhook URL provided by the user
- `{{monitor.name}}` — the name of the monitor that triggered the event
- `{{event.status}}` — the current status (`up`, `down`, `degraded`)

## Security Rules

- Do not include real URLs or tokens in fixtures.
- Use only example and placeholder data.
- Replace every `example`, `placeholder`, and `redacted` value before submitting.
