# Connector Contract

## manifest.json

Defines provider identity, contributor-facing summary, supported delivery modes, and required fixture paths.

## auth.json

Declares the auth strategy and configuration shape. OAuth entries must include authorization URL, token URL, scopes, and placeholder environment variable references instead of live values.

## webhook.json

Describes webhook setup expectations, supported event families, signature verification hints, and payload fixture references.

## polling.json

Describes polling endpoints, pagination behavior, incremental cursor fields, backfill guidance, and example page fixtures.

## mapping.json

Maps provider payload fields into canonical StatuspageOne event fields and normalized route names.

## Behavioral Expectations

- If a provider offers webhooks, document delivery setup and event coverage in `webhook.json`.
- If a provider requires polling, declare cursor semantics, page traversal, and rate-limit assumptions in `polling.json`.
- If a provider supports both, keep both files present and internally consistent.
- Route names must be normalized, stable, and provider-agnostic where possible.
