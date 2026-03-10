# Authoring Guide

## Workflow

1. Copy `templates/connector` to `connectors/<provider-slug>`.
2. Replace every placeholder with provider-specific metadata.
3. Keep every example sanitized and obviously fake.
4. Run `pnpm validate` before opening a pull request.

## Required Files

Each connector folder must include:

- `manifest.json`
- `auth.json`
- `webhook.json`
- `polling.json`
- `mapping.json`
- `README.md`
- `fixtures/webhook-event.json`
- `fixtures/polling-page.json`

## Authoring Rules

- Describe both webhook and polling behavior when the provider supports both.
- Model OAuth declaratively. Include scopes, token URLs, and required environment variable names, but never real credentials.
- Normalize provider routes into stable internal route names and field shapes.
- Keep runtime logic, importer code, and any private tenant assumptions out of this repository.
