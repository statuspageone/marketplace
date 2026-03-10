# StatuspageOne Marketplace

Public connector-authoring repository for StatuspageOne marketplace integrations.

## Quickstart

1. Copy `templates/connector` into `connectors/<provider-slug>`.
2. Replace placeholder metadata, auth config, fixtures, and mappings.
3. Run `pnpm validate` from this repository.
4. Open a pull request with only sanitized examples and documentation.

## Documentation

- [Authoring Guide](docs/authoring-guide.md)
- [Connector Contract](docs/connector-contract.md)
- [Security And Redaction](docs/security-and-redaction.md)
- [Review Checklist](docs/review-checklist.md)

## Repository Layout

- `docs/` contributor documentation and review guidance
- `templates/` starter connector kit
- `connectors/` submitted connector definitions
- `schemas/` machine-readable JSON schemas
- `scripts/` local validation and repo checks

This repository is declarative only. Do not add secrets, runtime code, or private customer data.
