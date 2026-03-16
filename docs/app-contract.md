# App Contract

## Source App Contract

### manifest.yaml

Defines provider identity, contributor-facing summary, supported delivery modes, and required fixture paths.

### auth.yaml

Declares the auth strategy and configuration shape. OAuth entries must include authorization URL, token URL, scopes, and placeholder environment variable references instead of live values.

### webhook.yaml

Describes webhook setup expectations, supported event families, signature verification hints, and payload fixture references.

### polling.yaml

Describes polling endpoints, pagination behavior, incremental cursor fields, backfill guidance, and example page fixtures.

### mapping.yaml

Maps provider payload fields into canonical StatuspageOne event fields and normalized route names.

### Behavioral Expectations

- If a source app provider offers webhooks, document delivery setup and event coverage in `webhook.yaml`.
- If a source app provider requires polling, declare cursor semantics, page traversal, and rate-limit assumptions in `polling.yaml`.
- If a source app provider supports both, keep both files present and internally consistent.
- Route names must be normalized, stable, and provider-agnostic where possible.

## Destination App Contract

Destination apps send outbound alerts from StatusPageOne to external services.

### manifest.yaml

Declares the app identity (`slug`, `name`, `description`, `documentationUrl`), `app_type: destination`, `version`, `capabilities` (e.g., `webhook`), and a `files` map pointing to `auth`, `destinations`, and `delivery` files.

### auth.yaml

Specifies the auth `strategy` (`webhook_url`, `bearer`, or `none`) and any associated field configuration. No real tokens or URLs should appear here.

### destinations.yaml

Defines a `destinations` array. Each entry has an `id`, `name`, `description`, and optional `config_fields` that are shown to users during installation.

### delivery file

A free-named YAML file (referenced by `manifest.yaml files.delivery`) that describes the outbound HTTP request: method, URL template, headers, body type, body template, retry policy, and success codes. Liquid-style `{{variable}}` placeholders refer to installation config and event context.
