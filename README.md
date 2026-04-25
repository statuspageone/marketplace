# StatuspageOne Marketplace

Public app-authoring repository for StatuspageOne marketplace integrations.

## Quickstart

**Source apps** (inbound event providers):

1. Copy `templates/source` into `apps/<provider-slug>`.
2. Replace placeholder YAML metadata, auth config, fixtures, and mappings.
3. Run `pnpm validate` from this repository.
4. Open a pull request with only sanitized examples and documentation.

**Destination apps** (outbound alert targets):

1. Copy `templates/destination` into `apps/<your-slug>`.
2. Edit `manifest.yaml`, `auth.yaml`, `destination/targets.yaml`, and the delivery file.
3. Run `pnpm validate` from this repository.
4. Open a pull request with only sanitized examples and documentation.

## Repository Layout

- `README.md` contributor quickstart and repository overview
- `templates/` starter app templates (source and destination)
- `apps/` submitted app definitions, one folder per app slug
- `schemas/` machine-readable JSON schemas
- `scripts/` local validation and repo checks

This repository is declarative only. Do not add secrets, runtime code, or private customer data.
App definition files use YAML. Provider payload fixtures remain JSON.

## Submission Expectations

- Run `pnpm validate` locally before opening a pull request.
- Expect GitHub Actions to run the same validation in CI for every pull request.
- Use the repository pull request template to confirm fixture redaction, app scope, and documentation coverage.
