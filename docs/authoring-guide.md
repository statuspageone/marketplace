# Authoring Guide

## Workflow

1. Copy `templates/connector` to `connectors/<provider-slug>`.
2. Replace every placeholder with provider-specific metadata.
3. Keep every example sanitized and obviously fake.
4. Run `pnpm validate` before opening a pull request.

## Required Files

Each connector folder must include:

- `manifest.yaml`
- `auth.yaml`
- `webhook.yaml`
- `polling.yaml`
- `mapping.yaml`
- `README.md`
- `fixtures/webhook-event.json`
- `fixtures/polling-page.json`

## Authoring Rules

- Describe both webhook and polling behavior when the provider supports both.
- Model OAuth declaratively. Include scopes, token URLs, and required environment variable names, but never real credentials.
- Normalize provider routes into stable internal route names and field shapes.
- Keep runtime logic, importer code, and any private tenant assumptions out of this repository.

## Template Usage

The starter kit in `templates/connector` is intentionally fake. Replace every `example`, `placeholder`, and `redacted` value before submitting a real connector, but keep the replacements sanitized and public-safe.

## Authoring a Destination

1. Copy `templates/destination/` to `apps/destinations/<slug>/`.
2. Edit `manifest.yaml`: update `slug`, `name`, `description`, `documentationUrl`.
3. Edit `auth.yaml`: choose strategy (`webhook_url`, `bearer`, or `none`).
4. Edit `destinations.yaml`: define config fields shown to users during installation.
5. Edit the delivery file: define the outbound HTTP request template.
6. Add a sanitized fixture to `fixtures/`.
7. Run `pnpm validate` before opening a PR.
